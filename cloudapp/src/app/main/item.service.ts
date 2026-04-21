import { Injectable } from '@angular/core';
import {
  AlertService,
  CloudAppRestService,
  HttpMethod,
  RestErrorResponse
} from '@exlibris/exl-cloudapp-angular-lib';
import { HttpClient } from '@angular/common/http';
import { Observable, defer, of } from 'rxjs';
import { catchError, map, switchMap, timeout } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';

type SafeError = {
  error: true;
  message: string;
  status?: number;
  statusText?: string;
  url?: string;
  serverError?: string;
  context?: any;
};

@Injectable({
  providedIn: 'root'
})
export class ItemService {
  almaCourse: any;
  almaCourseId: any;
  readingLists: any;
  running = false;
  readingList: any;
  readingListObj: any;
  mms_id: any;
  previousCourseCode = '0';
  readingListId: any;
  selectedReadingList: any;
  singleList = false;
  citation: any;
  almaResult: any;
  original: any;
  item_record_update: any;
  almaReadingList: any;
  result: any;
  items: any[] = [];

  constructor(
    private restService: CloudAppRestService,
    private alert: AlertService,
    private translate: TranslateService,
    private http: HttpClient
  ) {}

private safeRestCall(request: any): Observable<any> {
  return defer(() => {
    try {
      return this.restService.call(request);
    } catch (err) {
      return of(this.toSafeError(err, this.describeRequest(request)));
    }
  }).pipe(
    timeout(30000), // 🔥 increase to 30 seconds (or more)
    catchError((err) =>
      of(this.toSafeError(err, this.describeRequest(request)))
    )
  );
}

  private describeRequest(request: string | { url?: string }): string {
    if (typeof request === 'string') {
      return `Request failed for ${request}`;
    }

    if (request?.url) {
      return `Request failed for ${request.url}`;
    }

    return 'Request failed';
  }

  private toSafeError(err: any, message: string, item?: any): SafeError {
    const safe: SafeError = {
      error: true,
      message
    };

    if (err instanceof ProgressEvent) {
      safe.message = `${message}: browser ProgressEvent`;
      return safe;
    }

    if (err?.message) {
      safe.message = `${message}: ${err.message}`;
    } else if (err?.statusText) {
      safe.message = `${message}: ${err.statusText}`;
    }

    if (typeof err?.status === 'number') {
      safe.status = err.status;
    }

    if (err?.statusText) {
      safe.statusText = err.statusText;
    }

    if (err?.url) {
      safe.url = err.url;
    }

    if (typeof err?.error === 'string') {
      safe.serverError = err.error;
    } else if (err?.error?.message) {
      safe.serverError = err.error.message;
    } else if (err?.error instanceof ProgressEvent) {
      safe.serverError = 'ProgressEvent';
    }

    if (item !== undefined) {
      safe.context = this.toSerializable(item);
    }

    return safe;
  }

  private toSerializable(value: any): any {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return String(value);
    }
  }

  private getString(obj: any, ...keys: string[]): string {
    for (const key of keys) {
      if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
        return String(obj[key]).replace(/[\{\}"']/g, '').trim();
      }
    }
    return '';
  }

  private encodeCoursePart(value: string): string {
    return encodeURIComponent(value).replace(/%20/g, '%2b');
  }

  private normalizeAlmaLink(link: string): string {
    const idx = link.indexOf('/almaws/v1/');
    return idx >= 0 ? link.substring(idx + 10) : link;
  }

  processUser(item: any, previousEntry: any[], previousCode: string[], processed: number): Observable<any> {
    const courseCodeRaw = this.getString(item, 'course_code', 'Course Code');
    const courseSectionRaw = this.getString(item, 'course_section', 'Course Section');
    const courseKey = courseSectionRaw ? `${courseCodeRaw}-${courseSectionRaw}` : courseCodeRaw;

    const previousCourseKey = previousCode.length ? previousCode[previousCode.length - 1] : '';
    if (processed > 0 && courseKey === previousCourseKey && previousEntry.length) {
      return of(previousEntry[previousEntry.length - 1]);
    }

    const encodedCode = this.encodeCoursePart(courseCodeRaw);
    const encodedSection = this.encodeCoursePart(courseSectionRaw);

    const url = encodedSection
      ? `/courses?q=code~${encodedCode}%20AND%20section~${encodedSection}`
      : `/courses?q=code~${encodedCode}`;

    return this.safeRestCall(url).pipe(
      switchMap((response: any) => {
        if (response?.error) {
          return of(response);
        }

        if (response?.course?.length) {
          return of(response);
        }

        if (response?.link) {
          return this.safeRestCall(this.normalizeAlmaLink(response.link));
        }

        return of({
          error: true,
          message: `No course found for ${courseKey}`
        });
      }),
      catchError((err) => of(this.toSafeError(err, `Error in course lookup for ${courseKey}`, item)))
    );
  }

  readingListLookup(
    course: any,
    courseCode: string,
    courseId: string,
    previousReadingListCourseCode: string[],
    previousRLEntry: any[],
    processed: number,
    valid: boolean,
    pub_status: string,
    visibility: string
  ): Observable<any> {
    if (!valid || !courseId) {
      return of({
        error: true,
        message: `invalid_course_reading_list_null for ${courseCode}`
      });
    }

    const previousCourseKey = previousReadingListCourseCode.length
      ? previousReadingListCourseCode[previousReadingListCourseCode.length - 1]
      : '';

    if (processed > 0 && courseCode === previousCourseKey && previousRLEntry.length) {
      return of(previousRLEntry[previousRLEntry.length - 1]);
    }

    const url = `/courses/${courseId}/reading-lists`;

    return this.safeRestCall(url).pipe(
      switchMap((readingLists: any) => {
        if (readingLists?.error) {
          return of(readingLists);
        }

        if (readingLists?.reading_list?.length === 1) {
          return of(readingLists);
        }

        if (readingLists?.reading_list?.length > 1) {
          return of({
            error: true,
            moreThanOne: true,
            message: `More than one reading list for ${courseCode}. Assignment ambiguous`,
            data: readingLists
          });
        }

        return this.createList(course, pub_status, visibility);
      }),
      catchError((err) => of(this.toSafeError(err, `Error in reading list lookup for ${courseCode}`, course)))
    );
  }

  getReadingList(id: any): Observable<any> {
    return this.safeRestCall(`/courses/${id}/reading-lists`).pipe(
      catchError((err) => of(this.toSafeError(err, `Error in reading list lookup for course id: ${id}`, id)))
    );
  }

  almaCourseLookup(course_code: any): void {
    this.safeRestCall(`/courses?code~${course_code}`).subscribe({
      next: (res: any) => {
        return this.almaCourseId?.map((_: any) => res?.course?.[0]?.id);
      },
      error: (err) => {
        console.error('almaCourseLookup failed', this.toSafeError(err, 'almaCourseLookup failed'));
      }
    });
  }

  createList(course: any, pub_status: string, visibility: string): Observable<any> {
    const courseRecord = course?.course?.[0];
    if (!courseRecord) {
      return of({
        error: true,
        message: 'Cannot create reading list: invalid course object'
      });
    }

    const readingListObj = {
      code: courseRecord.code,
      name: courseRecord.name,
      due_back_date: courseRecord.end_date,
      status: { value: 'BeingPrepared' },
      publishingStatus: { value: pub_status },
      visibility: { value: visibility }
    };

    return this.safeRestCall({
      url: `/courses/${courseRecord.id}/reading-lists`,
      method: HttpMethod.POST,
      headers: { 'Content-Type': 'application/json' },
      requestBody: JSON.stringify(readingListObj)
    }).pipe(
      map((result: any) => {
        if (result?.id || result?.error) {
          return result;
        }

        return {
          error: true,
          message: `Reading list creation failed for ${courseRecord.code}`
        };
      }),
      catchError((err) => of(this.toSafeError(err, 'Error with create list', courseRecord.code)))
    );
  }

  addToList(
    almaReadingListId: string,
    almaCourseId: string,
    mms_id: string,
    citation_type: string,
    reading_list_section: string,
    complete: boolean
  ): Observable<any> {
    const type = citation_type || 'BK';
    const section = reading_list_section || 'Resources';
    const completeSetting = complete ? 'Complete' : 'BeingPrepared';

    const citationBody = {
      status: { value: completeSetting },
      copyrights_status: { value: 'NOTREQUIRED' },
      type: { value: 'BK' },
      secondary_type: { value: type },
      metadata: { mms_id },
      section_info: {
        name: section,
        visibility: 'true'
      }
    };

    return this.safeRestCall(`/bibs/${mms_id}`).pipe(
      switchMap((bib: any) => {
        if (bib?.error) {
          return of(bib);
        }

        if (bib?.mms_id || bib?.bib) {
          return this.safeRestCall({
            url: `/courses/${almaCourseId}/reading-lists/${almaReadingListId}/citations`,
            method: HttpMethod.POST,
            headers: { 'Content-Type': 'application/json' },
            requestBody: JSON.stringify(citationBody)
          });
        }

        return of({
          error: true,
          message: `Lookup failed for MMS ID ${mms_id}`
        });
      }),
      catchError((err) => of(this.toSafeError(err, 'Error with adding citation to list', mms_id)))
    );
  }

  getCitations(almaReadingListId: string, almaCourseId: string): Observable<any> {
    return this.safeRestCall(`/courses/${almaCourseId}/reading-lists/${almaReadingListId}/citations`).pipe(
      catchError((err) => of(this.toSafeError(err, 'Error with getting citations for reading list', almaReadingListId)))
    );
  }

  getBib(mmsId: string): Observable<any> {
    return this.safeRestCall(`/bibs/${mmsId}`).pipe(
      catchError((err) => of(this.toSafeError(err, `Error with MMS ID look up for ${mmsId}`, mmsId)))
    );
  }

  updateItem(
  barcode: string,
  reserves_library: string,
  reserves_location: string,
  item_policy: string
): Observable<any> {
  return this.safeRestCall(`/items?item_barcode=${encodeURIComponent(barcode)}`).pipe(
    switchMap((item: any) => {
      if (item?.error) {
        return of(item);
      }

      if (!item?.link) {
        return of({
          error: true,
          message: `Item lookup failed for barcode ${barcode}`
        });
      }

      const relativeUrlMatch = String(item.link).match(/\/bibs\/.+$/);
      if (!relativeUrlMatch) {
        return of({
          error: true,
          message: `Could not derive Alma item URL from item.link for barcode ${barcode}`,
          link: item.link
        });
      }

      const url = relativeUrlMatch[0];

      item.holding_data = item.holding_data || {};

      if (reserves_library && reserves_location) {
        item.holding_data.in_temp_location = 'true';
        item.holding_data.temp_library = item.holding_data.temp_library || {};
        item.holding_data.temp_location = item.holding_data.temp_location || {};
        item.holding_data.temp_library.value = reserves_library;
        item.holding_data.temp_location.value = reserves_location;
      }

      if (item_policy) {
        item.holding_data.temp_policy = item.holding_data.temp_policy || {};
        item.holding_data.temp_policy.value = item_policy;
      }

      return this.safeRestCall({
        url,
        method: HttpMethod.PUT,
        headers: { 'Content-Type': 'application/json' },
        requestBody: JSON.stringify(item)
      });
    })
  );
}

  completeReadingLists(url: string): Observable<any> {
    return this.safeRestCall(url).pipe(
      switchMap((item: any) => {
        if (!item || item.error) {
          return of(item);
        }

        item.status = item.status || {};
        item.status.value = 'Complete';
        item.status.desc = 'Complete';

        return this.safeRestCall({
          url,
          method: HttpMethod.PUT,
          headers: { 'Content-Type': 'application/json' },
          requestBody: item
        });
      }),
      catchError((err) => of(this.toSafeError(err, 'Error with completing reading list', url)))
    );
  }

  sendDummyResponse(item: any): Observable<any> {
    return of(item);
  }

  isRepeat(listItem: string, lastItem: string, processed: number): Observable<boolean> {
    return of(listItem === lastItem || processed === 0);
  }

  extractCitationMmsIds(citations: any): string[] {
    const ids: string[] = [];

    if (Array.isArray(citations?.citation)) {
      citations.citation.forEach((citation: any) => {
        const mmsId = citation?.metadata?.mms_id;
        if (mmsId) {
          ids.push(mmsId);
        }
      });
    }

    return ids;
  }

  extractReadingListMeta(readingListResult: any): {
    valid: boolean;
    id: string;
    name: string;
    errorMessage: string;
  } {
    if (!readingListResult) {
      return {
        valid: false,
        id: '',
        name: '',
        errorMessage: 'Reading list result is empty'
      };
    }

    if (readingListResult?.error) {
      return {
        valid: false,
        id: '',
        name: '',
        errorMessage: readingListResult.message || 'Reading list error'
      };
    }

    if (readingListResult?.reading_list?.[0]) {
      return {
        valid: true,
        id: readingListResult.reading_list[0].id || '',
        name: readingListResult.reading_list[0].name || '',
        errorMessage: ''
      };
    }

    if (readingListResult?.id) {
      return {
        valid: true,
        id: readingListResult.id || '',
        name: readingListResult.name || '',
        errorMessage: ''
      };
    }

    return {
      valid: false,
      id: '',
      name: '',
      errorMessage: 'Unable to parse reading list response'
    };
  }

  private handleError(e: RestErrorResponse, item: any, message: String): any {
    return this.toSafeError(e, String(message), item);
  }

  private handleErrorTooManyReadingLists(e: RestErrorResponse, item: any): any {
    return this.toSafeError(e, 'Too many reading lists. Assignment Ambiguous', item);
  }
}