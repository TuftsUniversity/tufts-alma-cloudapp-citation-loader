import { Injectable } from '@angular/core';
import {
  CloudAppRestService,
  CloudAppEventsService,
  CloudAppSettingsService
} from '@exlibris/exl-cloudapp-angular-lib';
import { HttpClient } from '@angular/common/http';
import { of, throwError, forkJoin, Observable } from 'rxjs';
import { map, concatMap, catchError } from 'rxjs/operators';

import { Configuration } from '../models/configuration.model';
import { CourseResult } from '../models/course_result.model';

type LookupRow = Record<string, any>;

@Injectable({
  providedIn: 'root',
})
export class LookUpService {
  private settings: Configuration = new Configuration();

  private sruUrl: any;
  private institutionCode = '';

  constructor(
    private settingsService: CloudAppSettingsService,
    private restService: CloudAppRestService,
    private http: HttpClient,
    private initDataService: CloudAppEventsService
  ) {
    this.initDataService.getInitData().subscribe(data => {
      this.sruUrl = data.urls;
      this.institutionCode = data.instCode;
    });

    this.settingsService.get().subscribe(config => {
      this.settings = Object.assign(new Configuration(), config || {});
    });
  }

  handleRequest(item: LookupRow): Observable<any[]> {
    return this.searchPrimoApi(item);
  }

  private searchPrimoApi(row: LookupRow): Observable<any[]> {
    let title = row['Title - Input'] || '';
    const authorFirst = row['Author First - Input'] || '';
    const authorLast = row['Author Last - Input'] || '';
    const contributorFirst = row['Contributor First - Input'] || '';
    const contributorLast = row['Contributor Last - Input'] || '';
    const year = encodeURIComponent(row['Year - Input'] || '');

    let query = '';

    title = title.replace(/[,:;\."\u201C\u201D\u2018\u2019]/g, '');
    title = title.replace(/&/g, ' ');
    title = title.replace(/\s+/g, ' ').trim().normalize('NFC');

    if (title) {
      query += `alma.title==%22*${encodeURIComponent(title)}*%22`;
    } else {
      return this.noResultsResponse(row, 'Title');
    }

    if (authorLast) {
      if (authorFirst) {
        query += ` AND alma.creator=%22*${encodeURIComponent(authorLast)},${encodeURIComponent(authorFirst)}*%22`;
      } else {
        query += ` AND alma.creator=%22*${encodeURIComponent(authorLast)}*%22`;
      }
    }

    if (contributorLast) {
      if (contributorFirst) {
        query += ` AND alma.creator=%22*${encodeURIComponent(contributorLast)},${encodeURIComponent(contributorFirst)}*%22`;
      } else {
        query += ` AND alma.creator=%22*${encodeURIComponent(contributorLast)}*%22`;
      }
    }

    if (year) {
      query += ` AND %28alma.main_public_date=%22${year}%22 OR alma.date_of_publication=%22${year}%22%29`;
    }

    const baseUrl = this.sruUrl.alma.replace(/\/+$/, '');
    const fullURL = `${baseUrl}/view/sru/${this.institutionCode}?version=1.2&operation=searchRetrieve&recordSchema=marcxml&query=${query}`;

    console.log('Constructed SRU URL:', fullURL);

    return this.http.get(fullURL, { responseType: 'text' }).pipe(
      concatMap((xmlResponse: string) => this.parseXMLResponse(xmlResponse)),
      concatMap((parsedData: Document) => this.processMARCData(parsedData, row)),
      concatMap((marcResults: any[]) => {
        if (!Array.isArray(marcResults) || marcResults.length === 0) {
          console.warn('No MARC results found.');
          return of([]);
        }

        const courseDataObservables = marcResults.map((marcResult: any) => {
          return this.getCourseData(row).pipe(
            concatMap((courseData: CourseResult[]) => {
              if (courseData.length > 0) {
                return of(
                  courseData.map(course => ({
                    ...marcResult,
                    'Course Name': course['course_name'],
                    'Course Code': course['course_code'],
                    'Course Section': course['course_section'],
                    'Course Instructor': course['instructors']
                  }))
                );
              }

              return of([marcResult]);
            }),
            catchError(err => {
              console.error('Error fetching course data:', err);
              return of([marcResult]);
            })
          );
        });

        return forkJoin(courseDataObservables).pipe(
          map((results: any[]) => results.reduce((acc, val) => acc.concat(val), [])),
          catchError(err => {
            console.error('Error in processing forkJoin:', err);
            return of([]);
          })
        );
      }),
      catchError(error => {
        console.error('SRU API Error:', error);
        return throwError(error);
      })
    );
  }

  private noResultsResponse(row: LookupRow, _missingField: string): Observable<any[]> {
    const results = [{
      'Title': `No results for ${row['Title - Input'] || ''}`,
      'Author Last': `No results for ${row['Author Last - Input'] || ''}`,
      'Publisher': `No results for ${row['Publisher - Input'] || ''}`,
      'Date': `No results for ${row['Year - Input'] || ''}`,
      'course_code': row['Course Number - Input'] || '',
      'Returned Format': 'N/A'
    }];

    Object.keys(row).forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(results[results.length - 1], key)) {
        results[results.length - 1][key] = row[key];
      }
    });

    return of(results);
  }

  private parseXMLResponse(xmlResponse: string): Promise<Document> {
    return new Promise((resolve, reject) => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlResponse, 'application/xml');
      const parserError = xmlDoc.getElementsByTagName('parsererror');

      if (parserError.length > 0) {
        reject('Error parsing XML');
      } else {
        resolve(xmlDoc);
      }
    });
  }

  private extractDateFromRecord(record: Element): string | null {
    const controlFields = record.getElementsByTagNameNS('http://www.loc.gov/MARC21/slim', 'controlfield');
    let date008: string | null = null;

    for (let i = 0; i < controlFields.length; i++) {
      const controlField = controlFields[i];
      const tag = controlField.getAttribute('tag');
      if (tag === '008') {
        date008 = controlField.textContent;
        break;
      }
    }

    if (date008) {
      return this.getPreferredDate(date008);
    }

    return null;
  }

  private extractDates(date008: string): { date1: string | null; date2: string | null } {
    const date1 = date008.slice(7, 11);
    const date2 = date008.slice(11, 15);
    const isValidYear = (year: string) => /^\d{4}$/.test(year);

    return {
      date1: isValidYear(date1) ? date1 : null,
      date2: isValidYear(date2) ? date2 : null
    };
  }

  private getPreferredDate(date008: string): string | null {
    const { date1, date2 } = this.extractDates(date008);
    return date2 || date1;
  }

  private extractMARCData(record: Element, row: LookupRow): Observable<any[]> {
    const xpath = (tag: string, subfieldCode = ''): string => {
      const field = record.querySelector(`datafield[tag="${tag}"] subfield[code="${subfieldCode}"]`);
      return field ? (field.textContent || '') : '';
    };

    const rawFormat = (row['Format - Input'] || '').toString().trim().toLowerCase();

    const isExplicitPhysical = rawFormat === 'physical';
    const isExplicitElectronic = rawFormat === 'electronic';

    const wantsPhysical = isExplicitPhysical || (!isExplicitPhysical && !isExplicitElectronic);
    const wantsElectronic = isExplicitElectronic || (!isExplicitPhysical && !isExplicitElectronic);

    const barcodeArray: string[] = [];
    const electronicRecordArray: string[] = [];
    const observables: Observable<any[]>[] = [];

    const title = [xpath('245', 'a'), xpath('245', 'b')].filter(Boolean).join(' ').trim();
    const author =
      xpath('100', 'a') ||
      xpath('110', 'a') ||
      xpath('700', 'a') ||
      xpath('710', 'a') ||
      '';
    const publisher = xpath('264', 'b') || xpath('260', 'b') || '';
    const date = this.extractDateFromRecord(record);
    const isbn = xpath('020', 'a') || '';

    if (wantsPhysical) {
      const physMmsId = xpath('AVA', '0');

      if (physMmsId) {
        const itemQuery = `/bibs/${physMmsId}/holdings/ALL/items`;

        const physicalItemObservable = this.restService.call(itemQuery).pipe(
          map((items: any) => {
            const physicalResults: any[] = [];

            if (items?.total_record_count > 0 && Array.isArray(items.item)) {
              items.item.forEach((item: any) => {
                let library = item?.item_data?.library?.desc || '';
                let location = item?.item_data?.location?.desc || '';

                if (item?.holding_data?.in_temp_location) {
                  library = item?.holding_data?.temp_library?.desc || library;
                  location = item?.holding_data?.temp_location?.desc || location;
                }

                const barcode = item?.item_data?.barcode || '';

                if (barcode && !barcodeArray.includes(barcode)) {
                  barcodeArray.push(barcode);

                  physicalResults.push({
                    Title: title,
                    Author: author,
                    Publisher: publisher,
                    Date: date,
                    'MMS ID': physMmsId,
                    ISBN: isbn,
                    Library: library,
                    Location: location,
                    'Call Number': item?.holding_data?.permanent_call_number || '',
                    Barcode: barcode,
                    Description: item?.item_data?.description || '',
                    'Returned Format': 'Physical'
                  });
                }
              });
            }

            return physicalResults;
          }),
          catchError(err => {
            console.error('Error fetching physical items:', err);
            return of([]);
          })
        );

        observables.push(physicalItemObservable);
      }
    }

    if (wantsElectronic) {
      const eMmsId = xpath('AVE', '0');

      if (eMmsId && !electronicRecordArray.includes(`${eMmsId}Electronic`)) {
        electronicRecordArray.push(`${eMmsId}Electronic`);

        const electronicResults = [{
          Title: title,
          Author: author,
          Publisher: publisher,
          Date: date,
          'MMS ID': eMmsId,
          ISBN: isbn,
          'Returned Format': 'Electronic'
        }];

        observables.push(of(electronicResults));
      }
    }

    if (!observables.length) {
      return of([]);
    }

    return forkJoin(observables).pipe(
      map((resultsArray: any[][]) => resultsArray.reduce((acc, val) => acc.concat(val), [])),
      catchError(err => {
        console.error('Error in extractMARCData:', err);
        return of([]);
      })
    );
  }

  private processMARCData(xmlDoc: Document, row: LookupRow): Observable<any[]> {
    const records = xmlDoc.getElementsByTagNameNS('http://www.loc.gov/MARC21/slim', 'record');
    const observables: Observable<any[]>[] = [];

    if (records.length > 0) {
      for (let i = 0; i < records.length; i++) {
        const record = records[i];

        observables.push(
          this.extractMARCData(record, row).pipe(
            map((extractedData: any[]) => {
              extractedData.forEach(result => {
                Object.keys(row).forEach(key => {
                  if (!Object.prototype.hasOwnProperty.call(result, key)) {
                    result[key] = row[key];
                  }
                });
              });

              return extractedData;
            })
          )
        );
      }

      return forkJoin(observables).pipe(
        map((combinedResults: any[]) => combinedResults.reduce((acc, val) => acc.concat(val), []))
      );
    }

    const noResult = [{
      Title: `No results for ${row['Title - Input'] || ''}`,
      Author: `No results for ${row['Author - Input'] || ''}`,
      'Returned Format': 'N/A'
    }];

    Object.keys(row).forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(noResult[0], key)) {
        noResult[0][key] = row[key];
      }
    });

    return of(noResult);
  }

  private getCourseData(row: LookupRow): Observable<CourseResult[]> {
    const effectiveSettings = this.settings;
    const useLegacyMapping = effectiveSettings.useLegacyMapping !== false;

    const termForMapping = row['Course Term for Mapping - Input'] || '';
    const yearForMapping = row['Course Year for Mapping - Input'] || '';
    const course = row['Course Number - Input'] || '';
    const courseSemester = row['Course Semester - Input'] || '';
    const courseYear = row['Course Year - Input'] || '';
    const instructor = row['Instructor Last Name - Input'] || '';

    console.log('getCourseData invoked with row:', JSON.stringify(row));
    console.log('effectiveSettings:', JSON.stringify(effectiveSettings));
    console.log('useLegacyMapping:', useLegacyMapping);

    if (!useLegacyMapping) {
      if (!termForMapping || !yearForMapping) {
        console.warn('Missing term/year mapping fields for non-legacy course search.');
        return of([{
          course_name: 'error: missing term/year',
          course_code: '',
          course_section: '',
          instructors: ''
        }]);
      }

      const semesterCode =
        effectiveSettings.semesterMappings?.[termForMapping as keyof typeof effectiveSettings.semesterMappings] ||
        termForMapping;

      const namePattern = effectiveSettings.coursePattern || '{semester}-{course}-{year}';

      const courseName = namePattern
        .replace('{semester}', semesterCode || '')
        .replace('{course}', course || '')
        .replace('{year}', yearForMapping || '');

      let courseURL = `/courses?q=name~${encodeURIComponent(courseName)}`;

      if (instructor) {
        courseURL += `%20AND%20instructors~${encodeURIComponent(instructor)}`;
      }

      console.log('Constructed course search URL (non-legacy):', courseURL);

      return this.restService.call(courseURL).pipe(
        concatMap((response: any) => {
          const courseArray: CourseResult[] = [];

          if (response.course) {
            response.course.forEach((courseItem: any) => {
              const instructors = (courseItem.instructor || []).map((i: any) => i.last_name).join(';');
              courseArray.push({
                course_name: courseItem.name,
                course_code: courseItem.code,
                course_section: courseItem.section,
                instructors
              });
            });
          } else {
            courseArray.push({
              course_name: 'no results for course search',
              course_code: 'no results for course search',
              course_section: 'no results for course search',
              instructors: 'no results for course search'
            });
          }

          return of(courseArray);
        }),
        catchError(err => {
          console.error('Course lookup failed', err);
          return throwError(err);
        })
      );
    }

    const namePattern = effectiveSettings.coursePattern || '{semester}-{course}-{year}';
    const legacyCourseName = namePattern
      .replace('{semester}', courseSemester || '')
      .replace('{course}', course || '')
      .replace('{year}', courseYear || '');

    let courseURL = `/courses?q=name~${encodeURIComponent(legacyCourseName)}`;

    if (instructor) {
      courseURL += `%20AND%20instructors~${encodeURIComponent(instructor)}`;
    }

    console.log('Constructed course search URL (legacy):', courseURL);

    return this.restService.call(courseURL).pipe(
      concatMap((response: any) => {
        const courseArray: CourseResult[] = [];

        if (response.course) {
          response.course.forEach((courseItem: any) => {
            const instructors = (courseItem.instructor || []).map((i: any) => i.last_name).join(';');
            courseArray.push({
              course_name: courseItem.name,
              course_code: courseItem.code,
              course_section: courseItem.section,
              instructors
            });
          });
        } else {
          courseArray.push({
            course_name: 'no results for course search',
            course_code: 'no results for course search',
            course_section: 'no results for course search',
            instructors: 'no results for course search'
          });
        }

        return of(courseArray);
      }),
      catchError(err => {
        console.error('Course lookup failed', err);
        return throwError(err);
      })
    );
  }
}