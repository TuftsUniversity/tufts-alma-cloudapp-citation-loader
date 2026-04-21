import { Component, OnInit } from '@angular/core';
import { LookUpService } from './lookup-service.service';
import { CitationParserService } from './citation-parser.service';
import {
  AlertService,
  CloudAppRestService,
  CloudAppSettingsService,
  CloudAppEventsService,
} from '@exlibris/exl-cloudapp-angular-lib';
import * as XLSX from 'xlsx';
import { of, from, Observable } from 'rxjs';
import { catchError, finalize, concatMap, tap } from 'rxjs/operators';
import { Settings } from '../models/settings.model';
import { ParsedCitation } from '../models/parsed-citation.model';
import { Configuration } from '../models/configuration.model';

type LookupRow = Record<string, any>;

interface PasteCourseBlock {
  courseName: string;
  instructorLastName: string;
  courseNumber: string;
  courseSemester: string;
  courseYear: string;
  courseTermForMapping: string;
  courseYearForMapping: string;
  citationsText: string;
}

@Component({
  selector: 'app-lookup-tool',
  templateUrl: './lookup-tool.component.html',
  styleUrls: ['./lookup-tool.component.scss']
})
export class LookupToolComponent implements OnInit {
  private settings!: Settings;

  courseData: LookupRow[] = [];
  progressBarValue = 0;
  files: File[] = [];
  arrayBuffer: ArrayBuffer | string | null = null;
  loading = false;
  loadingConfig = false;
  config: Configuration = new Configuration();
  parsedCitations: ParsedCitation[] = [];

  inputMode: 'spreadsheet' | 'paste' = 'spreadsheet';
  reviewMode = false;

  pasteBlocks: PasteCourseBlock[] = [
    this.createEmptyPasteBlock()
  ];

  constructor(
    private lookUpService: LookUpService,
    private alert: AlertService,
    private restService: CloudAppRestService,
    private eventsService: CloudAppEventsService,
    private settingsService: CloudAppSettingsService,
    private citationParserService: CitationParserService
  ) {
    this.settingsService.get().subscribe(config => {
      this.settings = config as Settings;
    });
  }

  ngOnInit(): void {
    this.loadingConfig = true;

    this.settingsService.get().subscribe({
      next: (res: Configuration) => {
        this.config = Object.assign(new Configuration(), res || {});
        this.loadingConfig = false;
      },
      error: (err: Error) => {
        console.error(err.message);
        this.config = new Configuration();
        this.loadingConfig = false;
      }
    });
  }

  private createEmptyPasteBlock(): PasteCourseBlock {
    return {
      courseName: '',
      instructorLastName: '',
      courseNumber: '',
      courseSemester: '',
      courseYear: '',
      courseTermForMapping: '',
      courseYearForMapping: '',
      citationsText: ''
    };
  }

  addPasteBlock(): void {
    this.pasteBlocks.push(this.createEmptyPasteBlock());
  }

  removePasteBlock(index: number): void {
    if (this.pasteBlocks.length === 1) {
      this.pasteBlocks[0] = this.createEmptyPasteBlock();
      return;
    }

    this.pasteBlocks.splice(index, 1);
  }

  onSelect(event: { addedFiles: File[] }): void {
    this.files = [...event.addedFiles];
  }

  onRemove(file: File): void {
    this.files.splice(this.files.indexOf(file), 1);
  }

  handlePastedCitations(): void {
    const activeBlocks = this.pasteBlocks.filter(block => (block.citationsText || '').trim());

    if (!activeBlocks.length) {
      this.alert.error('Please paste at least one citation.');
      return;
    }

    this.parsedCitations = [];

    activeBlocks.forEach((block: PasteCourseBlock) => {
      const parsed = this.citationParserService.parseBlock(
        block.citationsText,
        {
          courseName: block.courseName,
          instructor: block.instructorLastName,
          courseNumber: block.courseNumber,
          courseSemester: block.courseSemester,
          courseYear: block.courseYear,
          courseTermForMapping: block.courseTermForMapping,
          courseYearForMapping: block.courseYearForMapping
        } as any
      );

      this.parsedCitations.push(...parsed);
    });

    if (!this.parsedCitations.length) {
      this.alert.error('No citations could be parsed.');
      return;
    }

    this.reviewMode = true;

    const rows: LookupRow[] = this.parsedCitations.map((citation: ParsedCitation) =>
      this.flattenCitation(citation)
    );

    /**
     * Sort by course so repeated course lookups reuse cache immediately,
     * similar to the spreadsheet path.
     */
    rows.sort((a: LookupRow, b: LookupRow) => {
      const aKey = this.getCourseSortKey(a);
      const bKey = this.getCourseSortKey(b);
      return aKey.localeCompare(bKey);
    });

    this.processRows(rows);
  }

  handleUpload(): void {
    if (!this.files.length) {
      this.alert.error('Please select a file first.');
      return;
    }

    const fileReader = new FileReader();

    fileReader.onload = (_e: ProgressEvent<FileReader>) => {
      this.arrayBuffer = fileReader.result;

      if (!(this.arrayBuffer instanceof ArrayBuffer)) {
        this.alert.error('Unable to read the uploaded file.');
        return;
      }

      const data = new Uint8Array(this.arrayBuffer);
      const arr: string[] = [];

      for (let i = 0; i !== data.length; ++i) {
        arr[i] = String.fromCharCode(data[i]);
      }

      const bstr = arr.join('');
      const workbook = XLSX.read(bstr, {
        type: 'binary',
        cellStyles: true,
        codepage: 65001
      });

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      let items: LookupRow[] = XLSX.utils.sheet_to_json(worksheet, {
        defval: '',
        skipHidden: true
      }) as LookupRow[];

      items = items.map((row: LookupRow) => {
        const updatedRow: LookupRow = {};

        Object.keys(row).forEach((key: string) => {
          const trimmedKey = key.trim();
          updatedRow[trimmedKey] = row[key];
        });

        return updatedRow;
      });

      items.sort((a: LookupRow, b: LookupRow) => {
        const aKey = this.getCourseSortKey(a);
        const bKey = this.getCourseSortKey(b);
        return aKey.localeCompare(bKey);
      });

      this.processRows(items);
    };

    fileReader.readAsArrayBuffer(this.files[0]);
  }

  private flattenCitation(citation: ParsedCitation): LookupRow {
    const firstAuthor = citation.creators.find(c => c.role === 'author');
    const firstEditor = citation.creators.find(c => c.role === 'editor');

    return {
      'Author First': firstAuthor?.given || '',
      'Author Last': firstAuthor?.family || '',
      'Contributor First': firstEditor?.given || '',
      'Contributor Last': firstEditor?.family || '',
      'Title': citation.title || '',
      'Publisher': citation.publisher || '',
      'Year': citation.year || '',
      'Course Number': citation.courseNumber || '',
      'Course Semester': citation.courseSemester || '',
      'Course Year': (citation as any).courseYear || '',
      'Instructor Last Name': citation.instructor || '',
      'Format': '',
      'Citation Type': citation.type || '',
      'Course Term for Mapping': citation.courseTermForMapping || '',
      'Course Year for Mapping': citation.courseYearForMapping || '',
      'Raw Citation': citation.raw,
      'All Authors': citation.creators
        .filter(c => c.role === 'author')
        .map(c => `${c.family}, ${c.given}`)
        .join('; '),
      'All Editors': citation.creators
        .filter(c => c.role === 'editor')
        .map(c => `${c.family}, ${c.given}`)
        .join('; ')
    };
  }

  private getCourseSortKey(row: LookupRow): string {
    const courseNumber = row['Course Number'] || row['Course Number - Input'] || '';
    const semester = row['Course Semester'] || row['Course Semester - Input'] || '';
    const year = row['Course Year'] || row['Course Year - Input'] || '';
    const instructor = row['Instructor Last Name'] || row['Instructor Last Name - Input'] || '';
    const termMap = row['Course Term for Mapping'] || row['Course Term for Mapping - Input'] || '';
    const yearMap = row['Course Year for Mapping'] || row['Course Year for Mapping - Input'] || '';

    return `${courseNumber}|${semester}|${year}|${instructor}|${termMap}|${yearMap}`.toLowerCase();
  }

  processFile(data: ArrayBuffer | string): void {
    const workbook = XLSX.read(data, { type: 'binary' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    let json: LookupRow[] = XLSX.utils.sheet_to_json(worksheet) as LookupRow[];

    json = json.map((row: LookupRow) => {
      const updatedRow: LookupRow = {};

      Object.keys(row).forEach((key: string) => {
        const trimmedKey = key.trim();
        updatedRow[trimmedKey] = row[key];
      });

      return updatedRow;
    });

    json.sort((a: LookupRow, b: LookupRow) => {
      const aKey = this.getCourseSortKey(a);
      const bKey = this.getCourseSortKey(b);
      return aKey.localeCompare(bKey);
    });

    this.processRows(json);
  }

  processRows(json: LookupRow[]): void {
    this.courseData = [];
    const totalCitations = json.length;
    let processedCitations = 0;
    this.loading = true;

    /**
     * Clear the service cache per run so each upload/paste batch is fresh,
     * while still reusing course lookups within the run.
     */
    this.lookUpService.clearCourseLookupCache();

    from(json).pipe(
      concatMap((row: LookupRow): Observable<any> => {
        const processedRow = this.processRow(row);

        if (!processedRow) {
          processedCitations++;
          this.progressBarValue = (processedCitations / totalCitations) * 100;
          return of(null);
        }

        return this.lookUpService.handleRequest(processedRow).pipe(
          tap((result: LookupRow[] | null) => {
            if (result) {
              this.courseData.push(...result);
            }
            processedCitations++;
            this.progressBarValue = (processedCitations / totalCitations) * 100;
          }),
          catchError(error => {
            console.error('Error processing row:', error);
            processedCitations++;
            this.progressBarValue = (processedCitations / totalCitations) * 100;
            return of(null);
          })
        );
      }),
      finalize(() => {
        this.generateExcel();
      })
    ).subscribe();
  }

  processRow(row: LookupRow): LookupRow | null {
    const authorFirst = row['Author First'] || '';
    const authorLast = row['Author Last'] || '';
    const contributorFirst = row['Contributor First'] || '';
    const contributorLast = row['Contributor Last'] || '';
    const title = row['Title'] || '';
    const publisher = row['Publisher'] || '';
    const year = row['Year'] || '';
    const courseNumber = row['Course Number'] || '';
    const courseSemester = row['Course Semester'] || '';
    const courseYear = row['Course Year'] || '';
    const instructor = row['Instructor Last Name'] || '';
    const format = row['Format'] || row['format'] || '';

    let courseTermMapping = '';
    let courseYearMapping = '';

    if (this.config && !this.config.useLegacyMapping) {
      const requiredColumns = ['Course Term for Mapping', 'Course Year for Mapping'];
      const missing = requiredColumns.filter((col: string) => !Object.keys(row).includes(col));

      if (missing.length > 0) {
        this.alert.error(`Missing required column(s) for course mapping: ${missing.join(', ')}`);
        return null;
      }

      courseTermMapping = row['Course Term for Mapping'] || '';
      courseYearMapping = row['Course Year for Mapping'] || '';
    }

    [
      'Author First',
      'Author Last',
      'Contributor First',
      'Contributor Last',
      'Title',
      'Publisher',
      'Year',
      'Course Number',
      'Course Semester',
      'Course Year',
      'Instructor Last Name',
      'Format',
      'format',
      'Course Term for Mapping',
      'Course Year for Mapping'
    ].forEach((key: string) => delete row[key]);

    const cRow: LookupRow = {
      'Author First - Input': authorFirst,
      'Author Last - Input': authorLast,
      'Contributor First - Input': contributorFirst,
      'Contributor Last - Input': contributorLast,
      'Title - Input': title,
      'Publisher - Input': publisher,
      'Year - Input': year,
      'Course Number - Input': courseNumber,
      'Course Semester - Input': courseSemester,
      'Course Year - Input': courseYear,
      'Instructor Last Name - Input': instructor,
      'Format - Input': format
    };

    if (this.config && !this.config.useLegacyMapping) {
      cRow['Course Term for Mapping - Input'] = courseTermMapping;
      cRow['Course Year for Mapping - Input'] = courseYearMapping;
    }

    for (const k in row) {
      if (!Object.prototype.hasOwnProperty.call(cRow, k) &&
          Object.prototype.hasOwnProperty.call(row, k)) {
        cRow[k] = row[k];
      }
    }

    return cRow;
  }

  sendDataToLookUpService(): void {
    if (this.courseData.length > 0) {
      this.generateExcel();
    } else {
      console.error('No data to generate Excel.');
    }
  }

  generateExcel(): void {
    const data: LookupRow[] = [];

    if (this.courseData && this.courseData.length > 1) {
      this.courseData.forEach((result: LookupRow) => {
        let title: string | undefined;
        let author: string | undefined;
        let publisher: string | undefined;
        let date: string | undefined;
        let mmsId: string | undefined;
        let isbn: string | undefined;
        let version: string | undefined;
        let courseName: string | undefined;
        let courseCode: string | undefined;
        let courseSection: string | undefined;
        let courseInstructor: string | undefined;
        let library: string | undefined;
        let libraryLocation: string | undefined;
        let callNumber: string | undefined;
        let barcode: string | undefined;
        let description: string | undefined;
        let format: string | undefined;

        if (result['Title']) title = result['Title'];
        if (result['Author']) author = result['Author'];
        if (result['Publisher']) publisher = result['Publisher'];
        if (result['Date']) date = result['Date'];
        if (result['MMS ID']) mmsId = result['MMS ID'];
        if (result['ISBN']) isbn = result['ISBN'];
        if (result['Version']) version = result['Version'];
        if (result['Course Name']) courseName = result['Course Name'];
        if (result['Course Code']) courseCode = result['Course Code'];
        if (result['Course Section']) courseSection = result['Course Section'];
        if (result['Course Instructor']) courseInstructor = result['Course Instructor'];
        if (result['Library']) library = result['Library'];
        if (result['Location']) libraryLocation = result['Location'];
        if (result['Call Number']) callNumber = result['Call Number'];
        if (result['Barcode']) barcode = result['Barcode'];
        if (result['Description']) description = JSON.stringify(result['Description']);
        if (result['Returned Format']) format = result['Returned Format'];

        const outputRow: LookupRow = {
          'Title': title,
          'Author': author,
          'Publisher': publisher,
          'Date': date,
          'MMS ID': mmsId,
          'ISBN': isbn,
          'Version': version,
          'Course Name': courseName,
          'Course Code': courseCode,
          'Course Section': courseSection,
          'Course Instructor': courseInstructor,
          'Returned Format': format,
          'Library': library,
          'Location': libraryLocation,
          'Call Number': callNumber,
          'Barcode': barcode,
          'Description': description,
          'Citation Type': result['Citation Type'] || '',
          'Section Info': result['section_info'] || '',
          'Item Policy': result['item_policy'] || result['Item Policy'] || ''
        };

        const newValues: LookupRow = {};
        for (const k in result) {
          if (!Object.prototype.hasOwnProperty.call(outputRow, k) &&
              k !== 'Description' &&
              Object.prototype.hasOwnProperty.call(result, k)) {
            newValues[k] = result[k];
          }
        }

        data.push(Object.assign(newValues, outputRow));
      });
    } else if (this.courseData.length === 1) {
      const result = this.courseData[0];

      let title: string | undefined;
      let author: string | undefined;
      let publisher: string | undefined;
      let date: string | undefined;
      let mmsId: string | undefined;
      let isbn: string | undefined;
      let version: string | undefined;
      let courseName: string | undefined;
      let courseCode: string | undefined;
      let courseSection: string | undefined;
      let courseInstructor: string | undefined;
      let library: string | undefined;
      let libraryLocation: string | undefined;
      let callNumber: string | undefined;
      let barcode: string | undefined;
      let description: string | undefined;
      let format: string | undefined;

      if (result['Title']) title = result['Title'];
      if (result['Author']) author = result['Author'];
      if (result['Publisher']) publisher = result['Publisher'];
      if (result['Date']) date = result['Date'];
      if (result['MMS ID']) mmsId = result['MMS ID'];
      if (result['ISBN']) isbn = result['ISBN'];
      if (result['Version']) version = result['Version'];
      if (result['Course Name']) courseName = result['Course Name'];
      if (result['Course Code']) courseCode = result['Course Code'];
      if (result['Course Section']) courseSection = result['Course Section'];
      if (result['Course Instructor']) courseInstructor = result['Course Instructor'];
      if (result['Library']) library = result['Library'];
      if (result['Location']) libraryLocation = result['Location'];
      if (result['Call Number']) callNumber = result['Call Number'];
      if (result['Barcode']) barcode = result['Barcode'];
      if (result['Description']) description = JSON.stringify(result['Description']);
      if (result['Returned Format']) format = result['Returned Format'];

      const outputRow: LookupRow = {
        'Title': title,
        'Author': author,
        'Publisher': publisher,
        'Date': date,
        'MMS ID': mmsId,
        'ISBN': isbn,
        'Version': version,
        'Course Name': courseName,
        'Course Code': courseCode,
        'Course Section': courseSection,
        'Course Instructor': courseInstructor,
        'Returned Format': format,
        'Library': library,
        'Location': libraryLocation,
        'Call Number': callNumber,
        'Barcode': barcode,
        'Description': description,
        'Citation Type': result['Citation Type'] || '',
        'Section Info': '',
        'Item Policy': ''
      };

      const newValues: LookupRow = {};
      for (const k in result) {
        if (!Object.prototype.hasOwnProperty.call(outputRow, k) &&
            k !== 'Description' &&
            Object.prototype.hasOwnProperty.call(result, k)) {
          newValues[k] = result[k];
        }
      }

      data.push(Object.assign(newValues, outputRow));
    }

    this.loading = false;

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, 'output.xlsx');
  }
}