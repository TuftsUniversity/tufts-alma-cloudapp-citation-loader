import { Injectable } from '@angular/core';
import { CloudAppRestService, CloudAppEventsService  } from '@exlibris/exl-cloudapp-angular-lib';
import { HttpClient } from '@angular/common/http';

import { of, throwError } from 'rxjs';
import { map, concatMap, catchError } from 'rxjs/operators';

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

handleRequest(item: any) {
  return this.searchPrimoApi(item).pipe(
    concatMap(result => {
      console.log(JSON.stringify(result));
      return result;
    }),
    
  
    catchError(error => {
      console.error('Error in handleRequest:', error);
      return throwError(error);
    })
  );
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
  //     query += `&query=alma.title==%22*${encodeURIComponent(title)}*%22`;
  //   } else {
  //     return this.noResultsResponse(row, 'Title');  // Handle the case when no title is provided
  //   }

  //   // Build the query part for author
  //   if (authorLast) {
  //     if (authorFirst) {
  //       query += `%20AND%20alma.creator=%22*${encodeURIComponent(authorLast)},${encodeURIComponent(authorFirst)}*%22`;
  //     } else {
  //       query += `%20AND%20alma.creator=%22*${encodeURIComponent(authorLast)}*%22`;
  //     }
  //   }

  //   // Build the query part for contributor
  //   if (contributorLast) {
  //     if (contributorFirst) {
  //       query += `%20AND%20alma.creator=%22*${encodeURIComponent(contributorLast)},${encodeURIComponent(contributorFirst)}*%22`;
  //     } else {
  //       query += `%20AND%20alma.creator=%22*${encodeURIComponent(contributorLast)}*%22`;
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
  private searchPrimoApi(row: any) {
    // Handle the inputs and transform them as in the PHP code
    let title = row['Title - Input'] || '';
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
    if (title) {
      title = title.replace(/[,:;."\']/g, '');  // Remove punctuation
      title = title.replace(/[-]/g, '');        // Replace hyphens with spaces
      title = title.replace(/[&]/g, '');        // Replace ampersands with spaces
    }
  
    let query = ``; // Build the SRU query
  
    // Build the query part for title
    if (title) {
      query += `&query=alma.title==%22*${encodeURIComponent(title)}*%22`;
    } else {
      return this.noResultsResponse(row, 'Title');  // Handle the case when no title is provided
    }
  
    // Build the query part for author
    if (authorLast) {
      if (authorFirst) {
        query += `%20AND%20alma.creator=%22*${encodeURIComponent(authorLast)},${encodeURIComponent(authorFirst)}*%22`;
      } else {
        query += `%20AND%20alma.creator=%22*${encodeURIComponent(authorLast)}*%22`;
      }
    }
  
    // Build the query part for contributor
    if (contributorLast) {
      if (contributorFirst) {
        query += `%20AND%20alma.creator=%22*${encodeURIComponent(contributorLast)},${encodeURIComponent(contributorFirst)}*%22`;
      } else {
        query += `%20AND%20alma.creator=%22*${encodeURIComponent(contributorLast)}*%22`;
      }
    }
  
    // Add year to query if present
    if (year) {
      query += `%20AND%20alma.main_pub_date=${year}`;
    }
  
    // Append other necessary constraints like suppressing suppressed records
    query += `%20AND%20alma.mms_tagSuppressed=false`;
  
    // Make the REST API call to SRU
    // return this.http.get(`${this.sruUrl.alma}/view/sru/${this.institutionCode}?version=1.2&operation=searchRetrieve&recordSchema=marcxml${query}`, { responseType: 'text' }).pipe(
    //   concatMap((xmlResponse: string) => this.parseXMLResponse(xmlResponse)),
    //   concatMap(parsedData => this.processMARCData(parsedData, row)),
    //   concatMap(marcResults => this.getCourseData(row).pipe(  // Combine with course data
    //     map(courseData => {
    //       courseData.forEach(result => {
    //         result.forEach(course => {
    //           //console.log(result);
    //           course['course_code'] = courseData['course_code'];  // Add course data to each MARC record
    //           course['course_section'] = courseData['course_section']

    //         })
            
    //       });


    //       return marcResults;  // Return combined results
    //     })
    //   )),
    //   catchError(error => {
    //     console.error('SRU API Error:', error);
    //     console.log(query);
    //     return throwError(error);
    //   })
    // );

    return this.http.get(`${this.sruUrl.alma}/view/sru/${this.institutionCode}?version=1.2&operation=searchRetrieve&recordSchema=marcxml${query}`, { responseType: 'text' }).pipe(
      concatMap((xmlResponse: string) => this.parseXMLResponse(xmlResponse)),
      concatMap(parsedData => this.processMARCData(parsedData, row)),
      concatMap(marcResults => {
        return this.getCourseData(row).pipe(
          map(courseData => {
            let combinedResults = [];
            marcResults.forEach(marcResult => {
              // For each MARC result, loop through all course data and create combinations
              courseData.forEach(course => {
                let combinedRow = {
                  ...marcResult, // Spread the MARC data
                  'course_code': course['course_code'], // Add course code
                  'course_section': course['course_section'] // Add course section
                };
                combinedResults.push(combinedRow); // Add each combination to the results array
              });
            });
            return combinedResults; // Return the fully combined results
          })
        );
      }),
      catchError(error => {
        console.error('SRU API Error:', error);
        console.log(query);
        return throwError(error);
      })
    );
    
    
    

  
  }
  
   
  // Function to return results when no matching title is found
  private noResultsResponse(row: any, missingField: string) {
    const results = [{
      'Title': `No results for ${row['Title - Input'] || ''}`,
      'Author Last': `No results for ${row['Author Last - Input'] || ''}`,
      'Publisher': `No results for ${row['Publisher - Input'] || ''}`,
      'Year': `No results for ${row['Year - Input'] || ''}`,
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
    //console.log(JSON.stringify(xmlResponse))
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


  
  private processMARCData(xmlDoc: Document, row: any) {
    const results = [];
    const records = xmlDoc.getElementsByTagName('record'); // Fetch all 'record' elements
  
    if (records.length > 0) {
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const extractedData = this.extractMARCData(record);
        results.push(extractedData);
  
        // Copy any additional row fields that aren't part of the standard MARC fields
        Object.keys(row).forEach(key => {
          if (!results[i].hasOwnProperty(key)) {
            results[i][key] = row[key];
          }
        });
      }
    } else {
      // No records found
      results.push({
        Title: `No results for ${row['Title'] || ''}`,
        Author: `No results for ${row['Author'] || ''}`,
        Returned_Format: 'N/A',
      });
  
      // Copy additional fields from the row into the result
      Object.keys(row).forEach(key => {
        if (!results[results.length - 1].hasOwnProperty(key)) {
          results[results.length - 1][key] = row[key];
        }
      });
    }
   // console.log(JSON.stringify(results))
    return of(results);
  }

  private extractMARCData(record: Element) {
    const xpath = (tag: string, subfieldCode: string = '') => {
      const field = record.querySelector(`datafield[tag="${tag}"] subfield[code="${subfieldCode}"]`);
      return field ? field.textContent : '';
    };
  
    return {
      Title: `${xpath('245', 'a')} ${xpath('245', 'b')}`.trim(),
      Author: xpath('100', 'a') || xpath('700', 'a') || xpath('710', 'a'),
      Publisher: xpath('264', 'b'),
      Year: xpath('264', 'c'),
      MMS_ID: xpath('AVA', '0'), // Physical item MMS ID
      ISBN: xpath('020', 'a'),
      Library: xpath('AVA', 'q'),
      Location: xpath('AVA', 'c'),
      Call_Number: xpath('AVA', 'd'),
      Barcode: xpath('AVA', 'f'),
      //Description: xpath('520', 'a'),
      Returned_Format: 'Physical', // Default for now
    };
  }
  

  // private processMARCData(parsedData: any, row: any) {
  //   const results = [];
  //   const records = parsedData['searchRetrieveResponse']?.records?.record || [];

  //   if (records.length > 0) {
  //     const barcodeArray = [];
  //     const electronicRecordArray = [];

  //     records.forEach(record => {
  //       const document = new DOMParser().parseFromString(record['recordData'], 'application/xml');
  //       const xpath = (path: string) => document.querySelector(path)?.textContent || '';

  //       const format = row['Format'] || '';

  //       // Handle physical items
  //       if (format === '' || format.toLowerCase() === 'physical') {
  //         const physMmsId = xpath('datafield[tag="AVA"] subfield[code="0"]');
  //         if (physMmsId) {
  //           const itemQuery = `/bibs/${physMmsId}/holdings/ALL/items`;

  //           return this.restService.call(itemQuery).pipe(
  //             map((items: any) => {
  //               if (items.total_record_count > 0) {
  //                 items.item.forEach(item => {
  //                   let library = item['item_data']['library']['desc'];
  //                   let location = item['item_data']['location']['desc'];
  //                   if (item['holding_data']['in_temp_location']) {
  //                     library = item['holding_data']['temp_library']['desc'];
  //                     location = item['holding_data']['temp_location']['desc'];
  //                   }

  //                   // Avoid duplicate barcodes
  //                   if (!barcodeArray.includes(item['item_data']['barcode'])) {
  //                     barcodeArray.push(item['item_data']['barcode']);
  //                   } else {
  //                     return;
  //                   }

  //                   const author = xpath('datafield[tag="100"] subfield[code="a"]') ||
  //                                  xpath('datafield[tag="700"] subfield[code="a"]') || 
  //                                  xpath('datafield[tag="710"] subfield[code="a"]');

  //                   results.push({
  //                     Title: xpath('datafield[tag="245"] subfield[code="a"]') + xpath('datafield[tag="245"] subfield[code="b"]'),
  //                     Author: author,
  //                     Publisher: xpath('datafield[tag="264"] subfield[code="b"]'),
  //                     Year: xpath('datafield[tag="264"] subfield[code="c"]'),
  //                     MMS_ID: physMmsId,
  //                     ISBN: xpath('datafield[tag="020"] subfield[code="a"]'),
  //                     Library: library,
  //                     Location: location,
  //                     Call_Number: item['holding_data']['permanent_call_number'] || '',
  //                     Barcode: item['item_data']['barcode'],
  //                     Description: item['item_data']['description'],
  //                     Returned_Format: 'Physical'
  //                   });

  //                   // Copy additional fields from the row into the result
  //                   Object.keys(row).forEach(key => {
  //                     if (!results[results.length - 1].hasOwnProperty(key)) {
  //                       results[results.length - 1][key] = row[key];
  //                     }
  //                   });
  //                 });
  //               }
  //               return results;
  //             })
  //           );
  //         }
  //       }

  //       // Handle electronic items
  //       if (format === '' || format.toLowerCase() === 'electronic') {
  //         const eMmsId = xpath('datafield[tag="AVE"] subfield[code="0"]');
  //         if (eMmsId && !electronicRecordArray.includes(`${eMmsId}Electronic`)) {
  //           electronicRecordArray.push(`${eMmsId}Electronic`);

  //           const author = xpath('datafield[tag="100"] subfield[code="a"]') || 
  //                          xpath('datafield[tag="110"] subfield[code="a"]') ||
  //                          xpath('datafield[tag="700"] subfield[code="a"]') ||
  //                          xpath('datafield[tag="710"] subfield[code="a"]');

  //           results.push({
  //             Title: xpath('datafield[tag="245"] subfield[code="a"]') + xpath('datafield[tag="245"] subfield[code="b"]'),
  //             Author: author,
  //             Publisher: xpath('datafield[tag="264"] subfield[code="b"]'),
  //             Year: xpath('datafield[tag="264"] subfield[code="c"]'),
  //             MMS_ID: eMmsId,
  //             ISBN: xpath('datafield[tag="020"] subfield[code="a"]'),
  //             Returned_Format: 'Electronic'
  //           });

  //           // Copy additional fields from the row into the result
  //           Object.keys(row).forEach(key => {
  //             if (!results[results.length - 1].hasOwnProperty(key)) {
  //               results[results.length - 1][key] = row[key];
  //             }
  //           });
  //         }
  //       }
  //     });
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

  //   return of(results);
  // }

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

    courseURL = `/courses?q=name~${row['Course Semester - Input']}-${row['Course Number - Input']}&format=json`;
  }

  else {
    courseURL = `/courses?q=name~${row['Course Semester - Input']}-${row['Course Number - Input']}"%20AND%20instructors~"${row['Instructor Last Name - Input']}&format=json`;
  }
  
  //console.log(courseURL);
  return this.restService.call(courseURL).pipe(
    map((response: any) => {

     // console.log(JSON.stringify(response));
        let courseArray = [];
        // Assuming the API returns a list of courses with sections
        if ('course' in response){
        response.course.forEach(course => {
         // console.log(JSON.stringify(course));
          courseArray.push({'course_code': course['code'], 'course_section': course['section']});
         
           
        });

      }

      else{
        courseArray = [{
          'Title': `No results for ${row['Title - Input'] || ''}`,
          'Author Last': `No results for ${row['Author Last - Input'] || ''}`,
          'Publisher': `No results for ${row['Publisher - Input'] || ''}`,
          'Year': `No results for ${row['Year - Input'] || ''}`,
          'course_code': row['Course Number - Input'] || '',
          'Returned Format': 'N/A'
        }];

      }
        return courseArray;
      ;  // Return the array of courses with code and section
    }),
    catchError(error => {
        console.error('Course Data Error:', error);
        return throwError(error);
    })
);
}
}
