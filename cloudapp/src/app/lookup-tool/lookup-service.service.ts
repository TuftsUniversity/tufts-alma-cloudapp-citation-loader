import { Injectable } from '@angular/core';
import { CloudAppRestService, CloudAppEventsService  } from '@exlibris/exl-cloudapp-angular-lib';
import { HttpClient } from '@angular/common/http';

import { of, throwError, forkJoin, Observable } from 'rxjs';
import { map, concatMap, catchError } from 'rxjs/operators';
import { HttpParams } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class LookUpService {

  private sruUrl: any;  // To store SRU URL
  private institutionCode: string = '';  // To store institution code



  constructor(
    private restService: CloudAppRestService,
    private http: HttpClient,
    private initDataService: CloudAppEventsService 
  ) {
    this.initDataService.getInitData().subscribe(data => {
      this.sruUrl = data.urls;  // Retrieve SRU URL
      this.institutionCode = data.instCode;  // Retrieve Institution Code
    });}

    handleRequest(item: any): Observable<any[]> {
      return this.searchPrimoApi(item);  // No need to chain getCourseData separately, as it’s combined in searchPrimoApi
    }

  // private searchPrimoApi(row: any) {
  //   // Handle the inputs and transform them as in the PHP code
  //   let title = row['Title - Input'] || '';
  //   let authorFirst = row['Author First - Input'] || '';
  //   let authorLast = row['Author Last - Input'] || '';
  //   let contributorFirst = row['Contributor First - Input'] || '';
  //   let contributorLast = row['Contributor Last - Input'] || '';
  //   let publisher = row['Publisher - Input'] || '';
  //   let year = encodeURIComponent(row['Year - Input'] || '');
  //   let courseNumber = encodeURIComponent(row['Course Number - Input'] || '');
  //   let courseSemester = encodeURIComponent(row['Course Semester - Input'] || '');
  //   let instructor = encodeURIComponent(row['Instructor Last Name - Input'] || '');
  //   let format = row['Format - Input'] || '';

  //   // Process the title string (remove unwanted characters, punctuation, and format)
  //   if (title) {
  //     title = title.replace(/[,:;."\']/g, '');  // Remove punctuation
  //     title = title.replace(/[-]/g, '');        // Replace hyphens with spaces
  //     title = title.replace(/[&]/g, '');        // Replace ampersands with spaces
  //   }

  //   let query = ``//`https://tufts.alma.exlibrisgroup.com/view/sru/01TUN_INST?version=1.2&operation=searchRetrieve&recordSchema=marcxml`;

  //   // Build the query part for title
  //   if (title) {
  //     query += `&query=alma.title==*${encodeURIComponent(title)}*`;
  //   } else {
  //     return this.noResultsResponse(row, 'Title');  // Handle the case when no title is provided
  //   }

  //   // Build the query part for author
  //   if (authorLast) {
  //     if (authorFirst) {
  //       query += `%20AND%20alma.creator=*${encodeURIComponent(authorLast)},${encodeURIComponent(authorFirst)}*`;
  //     } else {
  //       query += `%20AND%20alma.creator=*${encodeURIComponent(authorLast)}*`;
  //     }
  //   }

  //   // Build the query part for contributor
  //   if (contributorLast) {
  //     if (contributorFirst) {
  //       query += `%20AND%20alma.creator=*${encodeURIComponent(contributorLast)},${encodeURIComponent(contributorFirst)}*`;
  //     } else {
  //       query += `%20AND%20alma.creator=*${encodeURIComponent(contributorLast)}*`;
  //     }
  //   }

  //   // Add year to query if present
  //   if (year) {
  //     query += `%20AND%20alma.main_pub_date=${year}`;
  //   }

  //   // Append other necessary constraints like suppressing suppressed records
  //   query += `%20AND%20alma.mms_tagSuppressed=false`;

  //   // Make the REST API call to SRU
  //   return this.http.get(`${this.sruUrl.alma}/view/sru/${this.institutionCode}?version=1.2&operation=searchRetrieve&recordSchema=marcxml${query}`, { responseType: 'text' }).pipe(
  //     concatMap((xmlResponse: string) => this.parseXMLResponse(xmlResponse)),
  //     concatMap(parsedData => this.processMARCData(parsedData, row)),
  //     catchError(error => {
  //       console.error('SRU API Error:', error);
  //       console.log(query);
  //       return throwError(error);
        
  //     })
  //   );
  // }
  private searchPrimoApi(row: any): Observable<any[]> {
    // Handle the inputs and transform them as in the PHP code
    let title = row['Title - Input'] || '';
    console.log("Title");
    console.log(title);
    let authorFirst = row['Author First - Input'] || '';
    let authorLast = row['Author Last - Input'] || '';
    let contributorFirst = row['Contributor First - Input'] || '';
    let contributorLast = row['Contributor Last - Input'] || '';
    let publisher = row['Publisher - Input'] || '';
    let year = encodeURIComponent(row['Year - Input'] || '');
    let courseNumber = encodeURIComponent(row['Course Number - Input'] || '');
    let courseSemester = encodeURIComponent(row['Course Semester - Input'] || '');
    let instructor = encodeURIComponent(row['Instructor Last Name - Input'] || '');
    let format = row['Format - Input'] || '';
  
    // Process the title string (remove unwanted characters, punctuation, and format)
    // if (title) {
    //   title = title.replace(/[,:;."\']/g, '');  // Remove punctuation
    //   title = title.replace(/[-]/g, '');        // Replace hyphens with spaces
    //   title = title.replace(/[&]/g, '');        // Replace ampersands with spaces
    // }

    
  
    let query = ``; // Build the SRU query


  
    // Remove punctuation marks: , : ; . " ' “ ” ‘ ’
    //title = title.replace(/[,:;."'\“\”\‘\’]/g, ' ');
    title = title.normalize("NFD").replace(/[,:;\."'\“\”\‘\’]/g, '');



    console.log("after first normalize title");

    console.log(title);

    // Replace hyphens with spaces (uncomment if needed)
    // title = title.replace(/[-]/g, ' ');

    // Replace ampersands with spaces
    title = title.replace(/&/g, ' ');

    title = title.replace(/\s+/g, ' ').trim().normalize("NFC");

    console.log("After second normalize title");
    console.log(title)

   
    // Build the query part for title
    if (title) {
      query += `alma.title==*${encodeURIComponent(title)}*`;
    } else {
      return this.noResultsResponse(row, 'Title');  // Handle the case when no title is provided
    }
  
    console.log("Parsed query component title");
    console.log(title);
    
    // Build the query part for author
    if (authorLast) {
      if (authorFirst) {
        query += ` AND alma.creator=*${encodeURIComponent(authorLast)},${encodeURIComponent(authorFirst)}*`;
      } else {
        query += ` AND alma.creator=*${encodeURIComponent(authorLast)}*`;
      }
    }
  
    // Build the query part for contributor
    if (contributorLast) {
      if (contributorFirst) {
        query += ` AND alma.creator=*${encodeURIComponent(contributorLast)},${encodeURIComponent(contributorFirst)}*`;
      } else {
        query += ` AND alma.creator=*${encodeURIComponent(contributorLast)}*`;
      }
    }
  
    // Add year to query if present
    if (year) {
      query += ` AND %28alma.main_public_date=${year} OR alma.date_of_publication=${year}%29`;
    }
  
    var url = `${this.sruUrl.alma}/view/sru/${this.institutionCode}`//?version=1.2&operation=searchRetrieve&recordSchema=marcxml${query}`;

    url = url.replace(/\/\/view\/sru/g, "\/view\/sru");
    console.log(url);
 // Make the REST API call to SRU
 
 const queryParams = new HttpParams()
  .set('version', '1.2')
  .set('operation', 'searchRetrieve')
  .set('recordSchema', 'marcxml')
  .set('query', query);

const baseUrl = this.sruUrl.alma.replace(/\/+$/, '');
var fullURL = `${baseUrl}/view/sru/${this.institutionCode}?version=1.2&operation=searchRetrieve&recordSchema=marcxml&query=${query}`;
console.log(fullURL)
 return this.http.get(fullURL, { responseType: 'text' })
 .pipe(
   concatMap((xmlResponse: string) => this.parseXMLResponse(xmlResponse)),
   concatMap(parsedData => this.processMARCData(parsedData, row)),
   concatMap((marcResults: any[]) => {
     // Validate if marcResults is a proper array
     if (!Array.isArray(marcResults) || marcResults.length === 0) {
       console.warn('No MARC results found.');
       return of([]); // If no MARC results, return an empty array observable
     }

     // Map each MARC result to an observable from getCourseData()
     const courseDataObservables = marcResults.map((marcResult: any) => {
       // Ensure getCourseData returns an observable
       return this.getCourseData(row).pipe(
         concatMap((courseData: any[]) => {
           // If multiple courses, map each course to the MARC result
           if (courseData.length > 0) {
             return of(
               courseData.map(course => ({
                 ...marcResult,
                 'Course Name': course['course_name'],
                 'course_code': course['course_code'],
                 'course_section': course['course_section'],
                 'Course Instructor': course['instructors']
               }))
             );
           } else {
             // If no courses found, just return the MARC result as-is
             return of([marcResult]);
           }
         }),
         catchError(err => {
           console.error('Error fetching course data:', err);
           return of([marcResult]); // Return the MARC result even if there's an error fetching courses
         })
       );
     });

     // Use forkJoin to combine all course data observables for all MARC results
     return forkJoin(courseDataObservables).pipe(
       map((results: any[]) => {
         // Flatten the nested arrays (since courseData may return multiple courses)
         return results.reduce((acc, val) => acc.concat(val), []);
       }),
       catchError(err => {
         console.error('Error in processing forkJoin:', err);
         return of([]); // Return an empty array in case of error
       })
     );
   }),
   catchError(error => {
     console.error('SRU API Error:', error);
     return throwError(error);
   })
 );
  }
 // Make SRU API call
  // Make the REST API call to SRU
  // return this.http.get(`${this.sruUrl.alma}/view/sru/${this.institutionCode}?version=1.2&operation=searchRetrieve&recordSchema=marcxml${query}`, { responseType: 'text' })
  //   .pipe(
  //     concatMap((xmlResponse: string) => this.parseXMLResponse(xmlResponse)),
  //     concatMap(parsedData => this.processMARCData(parsedData, row)),
  //     concatMap(marcResults => {
  //       // Collect course data for each MARC result
  //       const courseDataObservables = marcResults.map((marcResult: any) =>
  //         this.getCourseData(row).pipe(
  //           concatMap((courseData: any[]) => courseData.map(course => ({
  //             ...marcResult,  // Combine MARC data with course data
  //             'course_code': course['course_code'],
  //             'course_section': course['course_section']
  //           })))
  //         )
  //       );
  //       return forkJoin(courseDataObservables).pipe(
  //         concatMap((results: any[]) =>
  //           results.reduce((acc, val) => Array.isArray(val) ? acc.concat(...val) : acc.concat(val), [])  // Flatten only if val is an array
  //         )
  //       );

  //       return 
  //     }),
  //     catchError(error => {
  //       console.error('SRU API Error:', error);
  //       return throwError(error);
  //     })
  //   );


// private processMARCData(xmlDoc: Document, row: any) {
// const records = xmlDoc.getElementsByTagName('record');
// const results = [];

// // Handle both physical and electronic formats in extractMARCData
// for (let i = 0; i < records.length; i++) {
//   const record = records[i];
//   results.push(this.extractMARCData(record, row));
// }

// return forkJoin(results).pipe(
//   map(flattened => flattened.reduce((acc, val) => acc.concat(val), []))
// );
// }
  
   
  // Function to return results when no matching title is found
  private noResultsResponse(row: any, missingField: string) {
    const results = [{
      'Title': `No results for ${row['Title - Input'] || ''}`,
      'Author Last': `No results for ${row['Author Last - Input'] || ''}`,
      'Publisher': `No results for ${row['Publisher - Input'] || ''}`,
      'Date': `No results for ${row['Year - Input'] || ''}`,
      'course_code': row['Course Number - Input'] || '',
      'Returned Format': 'N/A'
    }];

    // Add extra fields from the row to the result
    Object.keys(row).forEach(key => {
      if (!results[results.length - 1].hasOwnProperty(key)) {
        results[results.length - 1][key] = row[key];
      }
    });

    return of(results);
  }


  private parseXMLResponse(xmlResponse: string): Promise<Document> {
    console.log(JSON.stringify(xmlResponse))
    return new Promise((resolve, reject) => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlResponse, 'application/xml');
      
      // Check if parsing was successful
      const parserError = xmlDoc.getElementsByTagName('parsererror');
      if (parserError.length > 0) {
        reject('Error parsing XML');
      } else {
        //console.log(JSON.stringify(xmlDoc))
        resolve(xmlDoc);
      }
    });
  }


  
  // private processMARCData(xmlDoc: Document, row: any) {
  //   const results = [];
  //   const records = xmlDoc.getElementsByTagName('record'); // Fetch all 'record' elements
  
  //   if (records.length > 0) {
  //     for (let i = 0; i < records.length; i++) {
  //       const record = records[i];
  //       const extractedData = this.extractMARCData(record);
  //       results.push(extractedData);
  
  //       // Copy any additional row fields that aren't part of the standard MARC fields
  //       Object.keys(row).forEach(key => {
  //         if (!results[i].hasOwnProperty(key)) {
  //           results[i][key] = row[key];
  //         }
  //       });
  //     }
  //   } else {
  //     // No records found
  //     results.push({
  //       Title: `No results for ${row['Title'] || ''}`,
  //       Author: `No results for ${row['Author'] || ''}`,
  //       Returned_Format: 'N/A',
  //     });
  
  //     // Copy additional fields from the row into the result
  //     Object.keys(row).forEach(key => {
  //       if (!results[results.length - 1].hasOwnProperty(key)) {
  //         results[results.length - 1][key] = row[key];
  //       }
  //     });
  //   }
  //  // console.log(JSON.stringify(results))
  //   return of(results);
  // }


  private extractMARCData(record: Element, row: any): Observable<any[]> {
    const xpath = (tag: string, subfieldCode: string = '') => {
      const field = record.querySelector(`datafield[tag="${tag}"] subfield[code="${subfieldCode}"]`);
      return field ? field.textContent : '';
    };
  
    const format = row['Format - Input'] || '';
    const barcodeArray: string[] = [];
    const electronicRecordArray: string[] = [];
    
    const observables: Observable<any>[] = [];  // Array to collect observables for forkJoin
  
    // Handle physical items
    if (format === '' || format.toLowerCase() === 'physical') {
      const physMmsId = xpath('AVA', '0');
      if (physMmsId) {
        const itemQuery = `/bibs/${physMmsId}/holdings/ALL/items`;
  
        // Push physical item API call as an observable into observables array
        const physicalItemObservable = this.restService.call(itemQuery).pipe(
          map((items: any) => {
            console.log(console.log(items));
            const physicalResults = [];
            if (items.total_record_count > 0) {
              items.item.forEach(item => {
                let library = item['item_data']['library']['desc'];
                let location = item['item_data']['location']['desc'];
                if (item['holding_data']['in_temp_location']) {
                  library = item['holding_data']['temp_library']['desc'];
                  location = item['holding_data']['temp_location']['desc'];
                }
  
                // Avoid duplicate barcodes
                if (!barcodeArray.includes(item['item_data']['barcode'])) {
                  barcodeArray.push(item['item_data']['barcode']);
                  const author = xpath('100', 'a') || xpath('700', 'a') || xpath('710', 'a');
                  physicalResults.push({
                    Title: xpath('245', 'a') + ' ' + xpath('245', 'b'),
                    Author: author,
                    Publisher: xpath('264', 'b'),
                    Date: xpath('264', 'c'),
                    'MMS ID': physMmsId,
                    ISBN: xpath('020', 'a'),
                    Library: library,
                    Location: location,
                    'Call Number': item['holding_data']['permanent_call_number'] || '',
                    Barcode: item['item_data']['barcode'],
                    Description: item['item_data']['description'],
                    'Returned Format': 'Physical'
                  });
                }
              });
            }
            console.log(console.log(physicalResults));
            return physicalResults;
          }),
          catchError(err => {
            console.error('Error fetching physical items:', err);
            return of([]); // Return an empty array if there is an error
          })
        );
  
        // Add the physical item observable to the array
        observables.push(physicalItemObservable);
      }
    }
  
    // Handle electronic items
    if (format === '' || format.toLowerCase() === 'electronic') {
      const eMmsId = xpath('AVE', '0');
      if (eMmsId && !electronicRecordArray.includes(`${eMmsId}Electronic`)) {
        electronicRecordArray.push(`${eMmsId}Electronic`);
        
        // Handle electronic items inline (no need for an API call here)
        const electronicResults = [{
          Title: xpath('245', 'a') + ' ' + xpath('245', 'b'),
          Author: xpath('100', 'a') || xpath('110', 'a') || xpath('700', 'a') || xpath('710', 'a'),
          Publisher: xpath('264', 'b'),
          Date: xpath('264', 'c'),
          'MMS ID': eMmsId,
          ISBN: xpath('020', 'a'),
          'Returned Format': 'Electronic'
        }];
  
        // Create an observable for electronic items and add it to the array
        observables.push(of(electronicResults));
      }
    }
  
    // Use forkJoin to combine the observables and return a flattened result
    return forkJoin(observables).pipe(
      map(resultsArray => {
        // Flatten the results from both physical and electronic items
        return resultsArray.reduce((acc, val) => acc.concat(val), []); // Flattening the array
      }),
      catchError(err => {
        console.error('Error in extractMARCData:', err);
        return of([]);  // Return an empty array if an error occurs
      })
    );
  }
  
  
  // private extractMARCData(record: Element, row: any) {
  //   const xpath = (tag: string, subfieldCode: string = '') => {
  //     const field = record.querySelector(`datafield[tag="${tag}"] subfield[code="${subfieldCode}"]`);
  //     return field ? field.textContent : '';
  //   };
  
  //   const format = row['Format - Input'] || '';
  //   const results: any[] = [];
  //   const barcodeArray: string[] = [];
  //   const electronicRecordArray: string[] = [];
  //   console.log(record);
  //   // Handle physical items
  //   if (format === '' || format.toLowerCase() === 'physical') {
  //     const physMmsId = xpath('AVA', '0');
  //     if (physMmsId) {
  //       console.log(physMmsId);
  //       const itemQuery = `/bibs/${physMmsId}/holdings/ALL/items`;
  
  //       return this.restService.call(itemQuery).pipe(
  //         map((items: any) => {
  //           console.log(JSON.stringify(items));
  //           if (items.total_record_count > 0) {
  //             console.log("there are items");
  //             items.item.forEach(item => {
  //               let library = item['item_data']['library']['desc'];
  //               let location = item['item_data']['location']['desc'];
  //               if (item['holding_data']['in_temp_location']) {
  //                 library = item['holding_data']['temp_library']['desc'];
  //                 location = item['holding_data']['temp_location']['desc'];
  //               }
  
  //               // Avoid duplicate barcodes
  //               if (!barcodeArray.includes(item['item_data']['barcode'])) {
  //                 barcodeArray.push(item['item_data']['barcode']);
  //               } else {
  //                 return;
  //               }
  
  //               const author = xpath('100', 'a') || xpath('700', 'a') || xpath('710', 'a');
  //               results.push({
  //                 Title: xpath('245', 'a') + ' ' + xpath('245', 'b'),
  //                 Author: author,
  //                 Publisher: xpath('264', 'b'),
  //                 Year: xpath('264', 'c'),
  //                 'MMS ID': physMmsId,
  //                 ISBN: xpath('020', 'a'),
  //                 Library: library,
  //                 Location: location,
  //                 'Call Number': item['holding_data']['permanent_call_number'] || '',
  //                 Barcode: item['item_data']['barcode'],
  //                 Description: item['item_data']['description'],
  //                 'Returned Format': 'Physical'
  //               });
  //             });
  //           }
  //           return results;
  //         })
  //       );
  //     }
  //   }
  
  //   // Handle electronic items
  //   if (format === '' || format.toLowerCase() === 'electronic') {
  //     const eMmsId = xpath('AVE', '0');
  //     if (eMmsId && !electronicRecordArray.includes(`${eMmsId}Electronic`)) {
  //       electronicRecordArray.push(`${eMmsId}Electronic`);
  
  //       const author = xpath('100', 'a') || xpath('110', 'a') || xpath('700', 'a') || xpath('710', 'a');
  //       results.push({
  //         Title: xpath('245', 'a') + ' ' + xpath('245', 'b'),
  //         Author: author,
  //         Publisher: xpath('264', 'b'),
  //         Year: xpath('264', 'c'),
  //         'MMS ID': eMmsId,
  //         ISBN: xpath('020', 'a'),
  //         'Returned Format': 'Electronic'
  //       });
  //     }
  //   }
  //   console.log(JSON.stringify(results));
  //   return of(results);
  // }
  
  // private searchPrimoApi(row: any) {
  //   let title = row['Title - Input'] || '';
  //   let authorLast = row['Author Last - Input'] || '';
  //   let year = encodeURIComponent(row['Year - Input'] || '');
  
  //   let query = ``;  // Construct the SRU query
  //   if (title) {
  //     query += `&query=alma.title==*${encodeURIComponent(title)}*`;
  //   } else {
  //     return this.noResultsResponse(row, 'Title');
  //   }
  
  //   return this.http.get(`${this.sruUrl.alma}/view/sru/${this.institutionCode}?version=1.2&operation=searchRetrieve&recordSchema=marcxml${query}`, { responseType: 'text' })
  //     .pipe(
  //       concatMap((xmlResponse: string) => this.parseXMLResponse(xmlResponse)),
  //       concatMap(parsedData => this.processMARCData(parsedData, row)),
  //       concatMap(marcResults => {
  //         const courseDataObservables = marcResults.map(marcResult =>
  //           this.getCourseData(row).pipe(
  //             map(courseData => courseData.map(course => ({
  //               ...marcResult,  // Combine MARC data with course data
  //               'course_code': course['course_code'],
  //               'course_section': course['course_section']
  //             })))
  //           )
  //         );
  //         return forkJoin(courseDataObservables).pipe(
  //           map(results => results.reduce((acc, val) => acc.concat(val), []))  // Flatten results
  //         );
  //       }),
  //       catchError(error => {
  //         console.error('SRU API Error:', error);
  //         return throwError(error);
  //       })
  //     );
  // }
  
  // private processMARCData(xmlDoc: Document, row: any): Observable<any[]> {
  //   const records = xmlDoc.getElementsByTagName('record');
  //   const results: Observable<any>[] = [];
  
  //   // Handle both physical and electronic formats in extractMARCData
  //   for (let i = 0; i < records.length; i++) {
  //     const record = records[i];
  //     results.push(this.extractMARCData(record, row));
  //   }
  
  
  // }
  

  private processMARCData(xmlDoc: Document, row: any): Observable<any[]> {
    const results: any[] = [];
    const records = xmlDoc.getElementsByTagNameNS("http://www.loc.gov/MARC21/slim", 'record'); // Fetch all 'record' elements
    const observables: Observable<any[]>[] = []; // Array to store the observables for each record
    console.log(records.length)
    if (records.length > 0) {
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        console.log(records)
        console.log(records[i])
        // Call extractMARCData and collect its observable
        observables.push(
          this.extractMARCData(record, row).pipe(
            map((extractedData: any[]) => {
              // Add additional fields from the row to each extracted result
              extractedData.forEach(result => {
                Object.keys(row).forEach(key => {
                  if (!result.hasOwnProperty(key)) {
                    result[key] = row[key];
                  }
                });
              });
              return extractedData; // Return the modified data
            })
          )
        );
      }
  
      // Use forkJoin to execute all observables concurrently and wait for all to complete
      return forkJoin(observables).pipe(
        map((combinedResults: any[]) => {
          // Flatten the combined results array into a single-level array
          return combinedResults.reduce((acc, val) => acc.concat(val), []);
        })
      );
    } else {
      // No records found, return placeholder result
      const noResult = [{
        Title: `No results for ${row['Title - Input'] || ''}`,
        Author: `No results for ${row['Author - Input'] || ''}`,
        'Returned Format': 'N/A'
      }];
  
      // Add additional fields from the row to the no result object
      Object.keys(row).forEach(key => {
        if (!noResult[0].hasOwnProperty(key)) {
          noResult[0][key] = row[key];
        }
      });
      return of(noResult);
    }
  }
  
  

  // private getCourseData(row: any) {
  //   const courseURL = `/courses?q=name~${row['Course Semester']}%20AND%20-${row['Course Number']}&format=json`;

  //   return this.restService.call(courseURL).pipe(
  //     map((response: any) => {
  //       return response.course || [];
  //     }),
  //     catchError(error => {
  //       console.error('Course Data Error:', error);
  //       return throwError(error);
  //     })
  //   );
  // }

  // Function to retrieve course data
private getCourseData(row: any) {
  let courseURL = ""
  if ('Instructor Last Name - Input' in row){
    //courseURL = `/courses?q=name~${row['Course Semester - Input']}-${row['Course Number - Input']}%20AND%20instructors~${row['Instructor Last Name - Input']}&format=json`;
      courseURL = `/courses?q=name~${row['Course Semester - Input']}-${row['Course Number - Input']}%20AND%20instructors~${row['Instructor Last Name - Input']}&format=json`
      }

  else {
    //courseURL = `/courses?q=name~${row['Course Semester - Input']}-${row['Course Number - Input']}&format=json`;
    courseURL = `/courses?q=name~${row['Course Semester - Input']}-${row['Course Number - Input']}&format=json`
 
      }
  
  console.log(courseURL);
  return this.restService.call(courseURL).pipe(
    concatMap((response: any) => {

      console.log(JSON.stringify(response));
        let courseArray = [];
        // Assuming the API returns a list of courses with sections
        if ('course' in response){
        response.course.forEach(course => {
         // console.log(JSON.stringify(course));

        let instructors = [];
         course['instructor'].forEach(instructor => {
          instructors.push(instructor['last_name'])
         });
         let instructorString = instructors.join(';')
          courseArray.push({'course_name': course['name'], 'course_code': course['code'], 'course_section': course['section'], 'instructors': instructorString});
         
           
        });

      }

      else{
        courseArray = [{
          'course_name': "no results for course search",
          'course_code': "no results for course search",
          'course_section': "no results for course search",
          'instructors': "no results for course search" 
        }];

      }
        return of(courseArray);
      ;  // Return the array of courses with code and section
    }),
    catchError(error => {
        console.error('Course Data Error:', error);
        return throwError(error);
    })
);
}
}
