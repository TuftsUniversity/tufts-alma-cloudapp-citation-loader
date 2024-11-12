import { Injectable } from '@angular/core';
import { CloudAppRestService, CloudAppEventsService  } from '@exlibris/exl-cloudapp-angular-lib';
import { HttpClient } from '@angular/common/http';

import { of, throwError, forkJoin, Observable, observable } from 'rxjs';
import { map, concatMap, catchError } from 'rxjs/operators';
import { MatCardAvatar } from '@angular/material/card';


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

  private searchPrimoApi(row: any): Observable<any[]> {
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
  
    
  
    let query = ``; // Build the SRU query


  
    // Remove punctuation marks: , : ; . " ' “ ” ‘ ’
    //title = title.replace(/[,:;."'\“\”\‘\’]/g, ' ');
    title = title.replace(/[,:;\."\u201C\u201D\u2018\u2019]/g, '');



  

 

    // Replace ampersands with spaces
    title = title.replace(/&/g, ' ');

    title = title.replace(/\s+/g, ' ').trim().normalize("NFC");



   
    // Build the query part for title
    if (title) {
      query += `alma.title==%22*${encodeURIComponent(title)}*%22`;
    } else {
      return this.noResultsResponse(row, 'Title');  // Handle the case when no title is provided
    }
  
 
    
    // Build the query part for author
    if (authorLast) {
      if (authorFirst) {
        query += ` AND alma.creator=%22*${encodeURIComponent(authorLast)},${encodeURIComponent(authorFirst)}*%22`;
      } else {
        query += ` AND alma.creator=%22*${encodeURIComponent(authorLast)}*%22`;
      }
    }
  
    // Build the query part for contributor
    if (contributorLast) {
      if (contributorFirst) {
        query += ` AND alma.creator=%22*${encodeURIComponent(contributorLast)},${encodeURIComponent(contributorFirst)}*%22`;
      } else {
        query += ` AND alma.creator=%22*${encodeURIComponent(contributorLast)}*%22`;
      }
    }
  
    // Add year to query if present
    if (year) {
      query += ` AND %28alma.main_public_date=%22${year}%22 OR alma.date_of_publication=%22${year}%22%29`;
    }
  
    var url = `${this.sruUrl.alma}/view/sru/${this.institutionCode}`//?version=1.2&operation=searchRetrieve&recordSchema=marcxml${query}`;

    url = url.replace(/\/\/view\/sru/g, "\/view\/sru");
  
 // Make the REST API call to SRU
 


const baseUrl = this.sruUrl.alma.replace(/\/+$/, '');
var fullURL = `${baseUrl}/view/sru/${this.institutionCode}?version=1.2&operation=searchRetrieve&recordSchema=marcxml&query=${query}`;

 return this.http.get(fullURL, { responseType: 'text' })
 .pipe(
   concatMap((xmlResponse: string) => {
    console.log(xmlResponse);
    return this.parseXMLResponse(xmlResponse) 
   }
    
  ),
   concatMap(parsedData => 
    {
      console.log(parsedData);
      return this.processMARCData(parsedData, row)}),
   concatMap((marcResults: any[]) => {
    console.log(JSON.stringify(marcResults));
     // Validate if marcResults is a proper array
     if (!Array.isArray(marcResults) || marcResults.length === 0) {
       console.warn('No MARC results found.');
       return of([]); // If no MARC results, return an empty array observable
     }

     // Map each MARC result to an observable from getCourseData()
     const courseDataObservables = marcResults.map((marcResult: any) => {
      console.log(JSON.stringify(marcResult));
       // Ensure getCourseData returns an observable
       return this.getCourseData(row).pipe(
         concatMap((courseData: any[]) => {
          console.log(JSON.stringify(courseData));
           // If multiple courses, map each course to the MARC result
           if (courseData.length > 0) {
            console.log(JSON.stringify(courseData));
             return of(
               courseData.map(course => ({
                 ...marcResult,
                 'Course Name': course['course_name'],
                 'Course Code': course['course_code'],
                 'Course Section': course['course_section'],
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

    return new Promise((resolve, reject) => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlResponse, 'application/xml');
      
      // Check if parsing was successful
      const parserError = xmlDoc.getElementsByTagName('parsererror');
      if (parserError.length > 0) {
        reject('Error parsing XML');
      } else {

        resolve(xmlDoc);
      }
    });
  }

  private extractDateFromRecord(record: Element): string | null {
    // Fetch the 'controlfield' element with tag '008'
    const controlFields = record.getElementsByTagNameNS("http://www.loc.gov/MARC21/slim", "controlfield");
    let date008: string | null = null;

    for (let i = 0; i < controlFields.length; i++) {
        const controlField = controlFields[i];
        const tag = controlField.getAttribute("tag");
        if (tag === "008") {
            date008 = controlField.textContent;
            break;
        }
    }

    // If the 008 field was found, parse the date
    if (date008) {
        return this.getPreferredDate(date008);
    }

    return null; // Return null if 008 field is not found
}

  // Function to extract date from MARC 008 field
private extractDates(date008: string): { date1: string | null; date2: string | null } {
  // Date 1 is located at position 7-10 (4 characters)
  const date1 = date008.slice(7, 11);
  // Date 2 is located at position 11-14 (4 characters)
  const date2 = date008.slice(11, 15);

  // Check if Date 1 and Date 2 are valid numeric dates (they should be 4-digit years)
  const isValidYear = (year: string) => /^\d{4}$/.test(year);

  return {
      date1: isValidYear(date1) ? date1 : null,
      date2: isValidYear(date2) ? date2 : null
  };
}

// Function to get preferred date, choosing Date 2 if available, otherwise Date 1
private getPreferredDate(date008: string): string | null {
  const { date1, date2 } = this.extractDates(date008);
  return date2 || date1;  // Prefer Date 2 if valid, else Date 1
}



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

            const physicalResults = [];
            if (items.total_record_count > 0) {
              items.item.forEach(item => {
                let library = item['item_data']['library']['desc'];
                let location = item['item_data']['location']['desc'];
                if (item['holding_data']['in_temp_location']) {
                  library = item['holding_data']['temp_library']['desc'];
                  location = item['holding_data']['temp_location']['desc'];
                }
  
                const date = this.extractDateFromRecord(record);
   

                console.log("Date from 008");
                console.log(date)
                // Avoid duplicate barcodes
                if (!barcodeArray.includes(item['item_data']['barcode'])) {
                  barcodeArray.push(item['item_data']['barcode']);
                  const author = xpath('100', 'a') || xpath('700', 'a') || xpath('710', 'a');
                  physicalResults.push({
                    Title: xpath('245', 'a') + ' ' + xpath('245', 'b'),
                    Author: author,
                    Publisher: xpath('264', 'b'),
                    Date: date,
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

            console.log(JSON.stringify(physicalResults));
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
        let date008String = xpath('008');


        const date = this.extractDateFromRecord(record);
   

        console.log("Date from 008");
        console.log(date)
        // Handle electronic items inline (no need for an API call here)
        const electronicResults = [{
          Title: xpath('245', 'a') + ' ' + xpath('245', 'b'),
          Author: xpath('100', 'a') || xpath('110', 'a') || xpath('700', 'a') || xpath('710', 'a'),
          Publisher: xpath('264', 'b'),
          Date: date,
          'MMS ID': eMmsId,
          ISBN: xpath('020', 'a'),
          'Returned Format': 'Electronic'
        }];
        console.log(JSON.stringify(electronicResults));
        // Create an observable for electronic items and add it to the array
        observables.push(of(electronicResults));
      }
    }
  
    if (observables.length > 0){
    // Use forkJoin to combine the observables and return a flattened result
    return forkJoin(observables).pipe(
      map(resultsArray => {
        console.log(JSON.stringify(resultsArray.reduce((acc, val) => acc.concat(val), [])));
        // Flatten the results from both physical and electronic items
        return resultsArray.reduce((acc, val) => acc.concat(val), []); // Flattening the array
      }),
      catchError(err => {
        console.error('Error in extractMARCData:', err);
        return of([]);  // Return an empty array if an error occurs
      })
    );
  }
  else{
    return of([]); 
  }
  }
  
  
  

  private processMARCData(xmlDoc: Document, row: any): Observable<any[]> {
    const results: any[] = [];
    
    const records = xmlDoc.getElementsByTagNameNS("http://www.loc.gov/MARC21/slim", 'record'); // Fetch all 'record' elements
    const observables: Observable<any[]>[] = []; // Array to store the observables for each record
    
    if (records.length > 0) {
      for (let i = 0; i < records.length; i++) {
        
        
        const record = records[i];
        console.log(record);
        // Call extractMARCData and collect its observable
        observables.push(
          this.extractMARCData(record, row).pipe(
            map((extractedData: any[]) => {
              console.log(JSON.stringify(extractedData));
              // Add additional fields from the row to each extracted result
              extractedData.forEach(result => {
                Object.keys(row).forEach(key => {
                  if (!result.hasOwnProperty(key)) {
                    result[key] = row[key];
                  }
                });
              });
              console.log(JSON.stringify(extractedData));
              
              return extractedData; // Return the modified data
            })
          )
        );
      }
  
      // Use forkJoin to execute all observables concurrently and wait for all to complete
      return forkJoin(observables).pipe(
        map((combinedResults: any[]) => {
          console.log(JSON.stringify(combinedResults));
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
  

  return this.restService.call(courseURL).pipe(
    concatMap((response: any) => {

 
        let courseArray = [];
        // Assuming the API returns a list of courses with sections
        if ('course' in response){
        response.course.forEach(course => {
  
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
