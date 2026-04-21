import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CloudAppRestService, CloudAppSettingsService } from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateService } from '@ngx-translate/core';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver-es';

import { from, Observable, of, Subscription } from 'rxjs';
import {concatMap, switchMap, map, tap, catchError, toArray, finalize } from 'rxjs/operators';
import { Settings } from '../models/settings.model';
import { Configuration } from '../models/configuration.model';
import { ItemService } from './item.service';

type SpreadsheetRow = Record<string, any>;

interface ProcessResult {
  courseKey: string;
  mmsId: string;
  barcode: string;
  readingListSection: string;
  citationType: string;
  itemPolicy: string;
  reservesLibrary: string;
  reservesLocation: string;
  completeCitation: boolean;

  courseValid: boolean;
  readingListValid: boolean;
  citationExists: boolean;
  citationAdded: boolean;
  itemMoveAttempted: boolean;
  itemMoveValid: boolean;

  course?: any;
  courseId?: string;
  readingList?: any;
  readingListId?: string;
  readingListName?: string;
  citation?: any;
  citations?: any;
  errorMessage?: string;
}

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit, OnDestroy {
  @ViewChild('drop', { static: false }) dropZone: any;

  private pageLoad$?: Subscription;
  private _apiResult: any;

  loadingConfig = false;
  loadingSettings = false;
  loading = false;
  hasApiResult = false;

  isChecked = false;
  moveRequested = false;
  complete = false;

  config!: Configuration;
  settings!: Settings;

  library = '';
  location = '';
  pub_status = '';
  visibility = '';

  files: File[] = [];
  arrayBuffer: ArrayBuffer | null = null;

  counter = 0;
  courseProcessed = 0;
  rLProcessed = 0;
  completedReadingLists = 0;

  resultMessage = '';

  previousCourseEntry: any[] = [];
  previousReadingListEntry: any[] = [];
  previousReadingListCode: string[] = [];
  previousCourseCode: string[] = [];
  uniqueCompletedReadingLists: string[] = [];
  uniqueNonComplete: string[] = [];
  completeArray: any[] = [];
  completedList: string[] = [];
  nonCompletedReadingLists: string[] = [];

  courseMMSIdInput = '';
  course_code = '';
  courses: any;
  reading_lists: any;

  private log = (str: string) => {
    this.resultMessage += str + '\n';
  };

  constructor(
    private itemService: ItemService,
    private translate: TranslateService,
    private restService: CloudAppRestService,
    private settingsService: CloudAppSettingsService
  ) {}

  ngOnInit(): void {
    this.loadingConfig = true;

    this.settingsService.get().subscribe({
      next: (res: Configuration) => {
        if (res && Object.keys(res).length !== 0) {
          this.config = res;
        }
        this.loadingConfig = false;
      },
      error: (err: Error) => {
        console.error(err.message);
        this.loadingConfig = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.pageLoad$?.unsubscribe();
  }

  onSelect(event: { addedFiles: File[] }): void {
    this.files = [...event.addedFiles];
  }

  onRemove(file: File): void {
    this.files.splice(this.files.indexOf(file), 1);
  }

  get apiResult(): any {
    return this._apiResult;
  }

  set apiResult(result: any) {
    this._apiResult = result;
    this.hasApiResult = !!(result && Object.keys(result).length > 0);
  }

  loadExecl(): void {
    if (!this.files.length) {
      return;
    }

    this.resetRunState();

    this.library = this.config?.mustConfig?.library || '';
    this.location = this.config?.from?.locations || '';
    this.isChecked = !!this.config?.isChecked;
    this.moveRequested = !!this.config?.moveRequested;
    this.pub_status = this.config?.mustConfig?.pub_status || 'DRAFT';
    this.visibility = this.config?.mustConfig?.visibility || 'ALL';
    this.loading = true;

    const fileReader = new FileReader();

    fileReader.onerror = (event: ProgressEvent<FileReader>) => {
      this.loading = false;
      this.log('Fatal error: unable to read spreadsheet.');
      console.error('FileReader error', this.toSafeError(event));
    };

    fileReader.onload = () => {
      try {
        this.arrayBuffer = fileReader.result as ArrayBuffer;
        const items = this.readSpreadsheet(this.arrayBuffer);
        this.processItems(items);
      } catch (err: any) {
        this.loading = false;
        const safe = this.toSafeError(err);
        console.error('Spreadsheet processing failed', safe);
        this.log(`Fatal error: ${safe.message}`);
      }
    };

    fileReader.readAsArrayBuffer(this.files[0]);
  }

  private resetRunState(): void {
    this.loading = false;
    this.courseProcessed = 0;
    this.rLProcessed = 0;
    this.resultMessage = '';
    this.completedReadingLists = 0;

    this.previousCourseEntry = [];
    this.previousReadingListEntry = [];
    this.uniqueCompletedReadingLists = [];
    this.uniqueNonComplete = [];
    this.completeArray = [];
    this.previousReadingListCode = [];
    this.previousCourseCode = [];
    this.completedList = [];
    this.nonCompletedReadingLists = [];
  }

private readSpreadsheet(data: ArrayBuffer): SpreadsheetRow[] {
  const bytes = new Uint8Array(data);
  const chars: string[] = [];

  for (let i = 0; i < bytes.length; i++) {
    chars[i] = String.fromCharCode(bytes[i]);
  }

  const bstr = chars.join('');
  const workbook = XLSX.read(bstr, { type: 'binary', cellStyles: true });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet: any = workbook.Sheets[firstSheetName];

  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
  const rowsMeta = worksheet['!rows'] || [];

  const allRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false
  });

  if (!allRows.length) {
    return [];
  }

  const headerRow = allRows[0].map((h: any) => String(h || '').trim());

  const visibleDataRows = allRows
    .slice(1)
    .filter((_: any[], idx: number) => {
      const worksheetRowNumber = idx + 2; // row 1 is header
      const rowMeta = rowsMeta[worksheetRowNumber - 1];
      return !(rowMeta && rowMeta.hidden);
    })
    .map((row: any[]) => {
      const obj: SpreadsheetRow = {};
      headerRow.forEach((header: string, colIndex: number) => {
        obj[header] = row[colIndex] ?? '';
      });
      return obj;
    });

  visibleDataRows.sort((a: SpreadsheetRow, b: SpreadsheetRow) => {
    const aCode = this.getString(a, 'course_code', 'Course Code');
    const bCode = this.getString(b, 'course_code', 'Course Code');
    return aCode.localeCompare(bCode);
  });

  return visibleDataRows;
}

  private processItems(items: SpreadsheetRow[]): void {
    const results: ProcessResult[] = [];

    from(items).pipe(
      
      concatMap((item: SpreadsheetRow) =>
        
        this.processSingleItem(item).pipe(
          tap((result: ProcessResult) => {
            
            results.push(result);
            this.courseProcessed += 1;
          }),
          catchError((err) => {
            const safe = this.toSafeError(err);

            const failedResult: ProcessResult = {
              courseKey: this.getCourseKey(item),
              mmsId: this.getString(item, 'mms_id', 'MMS ID'),
              barcode: this.getString(item, 'barcode', 'Barcode'),
              readingListSection: this.getString(item, 'section_info', 'Section Info'),
              citationType: this.getString(item, 'citation_type', 'Citation Type', 'secondary_type'),
              itemPolicy: this.getString(item, 'item_policy', 'Item Policy'),
              reservesLibrary: this.library,
              reservesLocation: this.location,
              completeCitation: this.isChecked || !this.getString(item, 'barcode', 'Barcode'),
              courseValid: false,
              readingListValid: false,
              citationExists: false,
              citationAdded: false,
              itemMoveAttempted: false,
              itemMoveValid: false,
              errorMessage: safe.message

              
            };

            
                          console.log('---- START ITEM ----', {
          course: this.getCourseKey(item),
         mmsId: this.getString(item, 'mms_id', 'MMS ID'),
          barcode: this.getString(item, 'barcode', 'Barcode')
  });


            results.push(failedResult);
            this.courseProcessed += 1;
            return of(failedResult);
          })
        )
      ),
      toArray(),
      finalize(() => {
        this.finishRun(results);
      })
    ).subscribe({
      error: (err) => {
        const safe = this.toSafeError(err);
        console.error('Citation loader failed', safe);
        this.loading = false;
        this.log(`Fatal error: ${safe.message}`);
      }
    });
  }

private processSingleItem(item: SpreadsheetRow): Observable<ProcessResult> {
  const mmsId = this.getString(item, 'mms_id', 'MMS ID');
  const barcode = this.getString(item, 'barcode', 'Barcode');
  const citationType = this.getString(item, 'citation_type', 'Citation Type', 'secondary_type');
  const readingListSection = this.getString(item, 'section_info', 'Section Info') || 'Resources';
  const itemPolicy = this.getString(item, 'item_policy', 'Item Policy');
  const reservesLibrary = this.library;
  const reservesLocation = this.location;
  const completeCitation = this.isChecked || !barcode;

  return this.itemService.processUser(
    item,
    this.previousCourseEntry,
    this.previousCourseCode,
    this.courseProcessed
  ).pipe(
    concatMap((courseResult: any): Observable<ProcessResult> => {
      this.previousCourseEntry.push(courseResult);

        console.log('Calling processUser (course lookup)', {
  courseKey: this.getCourseKey(item)
});
      const courseKey = this.getCourseKey(item, courseResult);
      this.previousCourseCode.push(courseKey);

      console.log('Course result', courseResult);
      const courseValid = !!(courseResult?.course?.[0]);
      const courseId = courseValid ? courseResult.course[0].id : '';

      console.log('Calling readingListLookup', {
        courseId,
        courseKey
      });
      return this.itemService.readingListLookup(
        courseResult,
        courseKey,
        courseId,
        this.previousReadingListCode,
        this.previousReadingListEntry,
        this.rLProcessed,
        courseValid,
        this.pub_status,
        this.visibility
      ).pipe(
        concatMap((readingListResult: any): Observable<ProcessResult> => {
          this.previousReadingListEntry.push(readingListResult);
          this.previousReadingListCode.push(courseKey);
          this.rLProcessed += 1;

          const readingListMeta = this.itemService.extractReadingListMeta(readingListResult);
          const readingListValid = readingListMeta.valid;
          console.log('Reading list result', readingListResult);
          if (!courseValid || !readingListValid || !readingListMeta.id || !courseId) {
            return of({
              courseKey,
              mmsId,
              barcode,
              readingListSection,
              citationType,
              itemPolicy,
              reservesLibrary,
              reservesLocation,
              completeCitation,
              courseValid,
              readingListValid,
              citationExists: false,
              citationAdded: false,
              itemMoveAttempted: false,
              itemMoveValid: false,
              course: courseResult,
              courseId,
              readingList: readingListResult,
              readingListId: readingListMeta.id,
              readingListName: readingListMeta.name,
              errorMessage: readingListMeta.errorMessage
            } as ProcessResult);
          }
          console.log('Calling getCitations', {
          courseId,
          readingListId: readingListMeta.id
        });
          return this.itemService.getCitations(readingListMeta.id, courseId).pipe(
            concatMap((citations: any): Observable<ProcessResult> => {
              const existingMmsIds = this.itemService.extractCitationMmsIds(citations);
              const citationExists = existingMmsIds.includes(mmsId);

              if (citationExists) {
                return of({
                  courseKey,
                  mmsId,
                  barcode,
                  readingListSection,
                  citationType,
                  itemPolicy,
                  reservesLibrary,
                  reservesLocation,
                  completeCitation,
                  courseValid,
                  readingListValid,
                  citationExists: true,
                  citationAdded: false,
                  itemMoveAttempted: false,
                  itemMoveValid: true,
                  course: courseResult,
                  courseId,
                  readingList: readingListResult,
                  readingListId: readingListMeta.id,
                  readingListName: readingListMeta.name,
                  citations
                } as ProcessResult);
              }

              console.log('Calling addToList', {
                courseId,
                readingListId: readingListMeta.id,
                mmsId
              });
              return this.itemService.addToList(
                readingListMeta.id,
                courseId,
                mmsId,
                citationType,
                readingListSection,
                completeCitation
              ).pipe(
                concatMap((citation: any): Observable<ProcessResult> => {
                  const canMove =
                    !!barcode &&
                    !!this.moveRequested &&
                    (!!itemPolicy || (!!reservesLibrary && !!reservesLocation));

                  if (!canMove) {
                    return of({
                      courseKey,
                      mmsId,
                      barcode,
                      readingListSection,
                      citationType,
                      itemPolicy,
                      reservesLibrary,
                      reservesLocation,
                      completeCitation,
                      courseValid,
                      readingListValid,
                      citationExists: false,
                      citationAdded: !citation?.error,
                      itemMoveAttempted: false,
                      itemMoveValid: true,
                      course: courseResult,
                      courseId,
                      readingList: readingListResult,
                      readingListId: readingListMeta.id,
                      readingListName: readingListMeta.name,
                      citation
                    } as ProcessResult);
                  }

                  console.log('Calling updateItem', {
                    barcode,
                    reservesLibrary,
                    reservesLocation,
                    itemPolicy
                  });
                  return this.itemService.updateItem(
                    barcode,
                    reservesLibrary,
                    reservesLocation,
                    itemPolicy
                  ).pipe(
                    map((moveResult: any): ProcessResult => ({
                      courseKey,
                      mmsId,
                      barcode,
                      readingListSection,
                      citationType,
                      itemPolicy,
                      reservesLibrary,
                      reservesLocation,
                      completeCitation,
                      courseValid,
                      readingListValid,
                      citationExists: false,
                      citationAdded: !citation?.error,
                      itemMoveAttempted: true,
                      itemMoveValid: !moveResult?.error,
                      course: courseResult,
                      courseId,
                      readingList: readingListResult,
                      readingListId: readingListMeta.id,
                      readingListName: readingListMeta.name,
                      citation
                    })),
                    catchError((err): Observable<ProcessResult> => {
                      const safe = this.toSafeError(err);
                      return of({
                        courseKey,
                        mmsId,
                        barcode,
                        readingListSection,
                        citationType,
                        itemPolicy,
                        reservesLibrary,
                        reservesLocation,
                        completeCitation,
                        courseValid,
                        readingListValid,
                        citationExists: false,
                        citationAdded: !citation?.error,
                        itemMoveAttempted: true,
                        itemMoveValid: false,
                        course: courseResult,
                        courseId,
                        readingList: readingListResult,
                        readingListId: readingListMeta.id,
                        readingListName: readingListMeta.name,
                        citation,
                        errorMessage: safe.message
                      } as ProcessResult);
                    })
                  );
                })
              );
            })
          );
        })
      );
    })
  );
}

  private finishRun(results: ProcessResult[]): void {
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    const updatedItems: string[] = [];
    let errorSummary = '';
    let skippedSummary = '';

    results.forEach((res: ProcessResult) => {
      if (!res.courseValid) {
        errorCount++;
        errorSummary += `Error for course ${res.courseKey}${res.errorMessage ? `: ${res.errorMessage}` : ''}\n`;
        this.nonCompletedReadingLists.push(res.courseKey);
        return;
      }

      if (!res.readingListValid) {
        errorCount++;
        errorSummary += `Error in reading list for course ${res.courseKey} and MMS ID ${res.mmsId}${res.errorMessage ? `: ${res.errorMessage}` : ''}\n`;
        this.nonCompletedReadingLists.push(res.courseKey);
        return;
      }

      if (res.citationExists) {
        skippedCount++;
        skippedSummary += `citation already exists for course ${res.courseKey} and MMS ID ${res.mmsId}\n`;
        return;
      }

      if (!res.citationAdded || !res.citation || res.citation.error) {
        errorCount++;
        errorSummary += `Bad MMS ID for course ${res.courseKey} and MMS ID ${res.mmsId}${res.errorMessage ? `: ${res.errorMessage}` : ''}\n`;
        this.nonCompletedReadingLists.push(res.courseKey);
        return;
      }

      const readingListName = res.readingListName || '';
      const citationId = res.citation?.id ? JSON.stringify(res.citation.id) : '';
      const sectionText = res.readingListSection ? `, section: ${JSON.stringify(res.readingListSection)}` : '';

      if (res.itemMoveAttempted && !res.itemMoveValid) {
        errorCount++;
        errorSummary += `Error moving physical items for course ${res.courseKey} and MMS ID ${res.mmsId} to library ${res.reservesLibrary} and location ${res.reservesLocation}\n`;
        this.nonCompletedReadingLists.push(res.courseKey);
        return;
      }

      if (res.itemMoveAttempted && res.itemMoveValid && !res.completeCitation) {
        updatedItems.push(
          `course code: ${JSON.stringify(res.courseKey)}, reading list: ${readingListName}${sectionText}, MMS ID: ${res.mmsId} citation: ${citationId} - Item with barcode ${res.barcode} sytemically moved to temp location but still needs to be physically moved and is not marked as complete`
        );
        successCount++;
        this.nonCompletedReadingLists.push(res.courseKey);
      } else if (!res.itemMoveAttempted && !res.completeCitation) {
        updatedItems.push(
          `course code: ${JSON.stringify(res.courseKey)}, reading list: ${readingListName}${sectionText}, MMS ID: ${res.mmsId} citation: ${citationId} - Item with barcode ${res.barcode} on reading list and remains in its current location but is not marked as complete`
        );
        successCount++;
        this.nonCompletedReadingLists.push(res.courseKey);
      } else if (res.itemMoveAttempted && res.itemMoveValid) {
        updatedItems.push(
          `course code: ${JSON.stringify(res.courseKey)}, reading list: ${readingListName}${sectionText}, MMS ID: ${res.mmsId} citation: ${citationId} - Item with barcode ${res.barcode} moved to new location`
        );
        successCount++;
      } else {
        updatedItems.push(
          `course code: ${JSON.stringify(res.courseKey)}, reading list: ${readingListName}${sectionText}, MMS ID: ${res.mmsId} citation: ${citationId}`
        );
        successCount++;
      }

      if (res.course?.course?.[0]?.id && res.readingListId) {
        const completeUrl = `/courses/${res.course.course[0].id}/reading-lists/${res.readingListId}`;
        if (!this.uniqueCompletedReadingLists.includes(completeUrl)) {
          this.uniqueCompletedReadingLists.push(completeUrl);
        }
      }
    });

    this.uniqueNonComplete = this.nonCompletedReadingLists.filter(
      (item: string, i: number, arr: string[]) => arr.indexOf(item) === i
    );

    this.log(`${this.translate.instant('Main.Processed')}: ${this.courseProcessed}`);
    this.log(`${this.translate.instant('Main.Updated')}: ${successCount}`);
    this.log(`Number of skipped records: ${skippedCount}`);
    this.log(`${this.translate.instant('Main.Failed')}: ${errorCount}\n`);

    if (errorSummary) {
      this.log(`Errors:\n ${errorSummary}`);
    }

    if (skippedSummary) {
      this.log(`Skipped: \n${skippedSummary}`);
    }

    if (updatedItems.length) {
      this.log(`${this.translate.instant('Main.ProcessedItems')}:\n ${updatedItems.join(', ')}`);
    }

    this.completeReadingLists();
    this.files = [];
  }

  completeReadingLists(): void {
    const results: any[] = [];

    from(this.uniqueCompletedReadingLists).pipe(
      concatMap((url: string) =>
        this.itemService.completeReadingLists(url).pipe(
          catchError((err) => of(this.toSafeError(err)))
        )
      ),
      toArray()
    ).subscribe({
      next: (arr: any[]) => {
        results.push(...arr);
      },
      error: (err) => {
        const safe = this.toSafeError(err);
        console.error('Error completing reading lists', safe);
        this.log(`Error completing reading lists: ${safe.message}`);
        this.loading = false;
      },
      complete: () => {
        results.forEach((res: any) => {
          if (!res?.error) {
            this.completedReadingLists++;
            if (res?.code) {
              this.completedList.push(res.code);
            }
          }
        });

        this.log(`${this.translate.instant('Number of Completed Reading Lists')}: ${this.completedReadingLists}`);
        this.log(`${this.translate.instant('Total Number of Non-Completed Reading Lists')}: ${this.uniqueNonComplete.length}`);

        if (this.completedList.length) {
          this.log(`${this.translate.instant('Completed Reading Lists')}:\n ${this.completedList.join(', ')}`);
        }

        if (this.uniqueNonComplete.length) {
          this.log(`${this.translate.instant('Non-Completed Reading Lists')}:\n ${this.uniqueNonComplete.join(', ')}`);
        }

        this.loading = false;
      }
    });
  }

  print(data: string): void {
    const file = new Blob([data], { type: 'text/plain' });
    saveAs(file, 'Log Export.txt');
  }

  private getString(row: SpreadsheetRow, ...keys: string[]): string {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
        return String(row[key]).replace(/[\{\}"']/g, '').trim();
      }
    }
    return '';
  }

  private getCourseKey(item: SpreadsheetRow, courseResult?: any): string {
    if (courseResult?.course?.[0]) {
      const code = courseResult.course[0].code || '';
      const section = courseResult.course[0].section || '';
      return section ? `${code}-${section}` : code;
    }

    const code = this.getString(item, 'course_code', 'Course Code');
    const section = this.getString(item, 'course_section', 'Course Section');
    return section ? `${code}-${section}` : code;
  }

  private toSafeError(err: any): { message: string; status?: any; statusText?: any; url?: any } {
    if (err instanceof ProgressEvent) {
      return { message: 'Browser ProgressEvent error' };
    }

    return {
      message:
        err?.message ||
        err?.error?.message ||
        (typeof err?.error === 'string' ? err.error : '') ||
        'Unknown error',
      status: err?.status,
      statusText: err?.statusText,
      url: err?.url
    };
  }
}