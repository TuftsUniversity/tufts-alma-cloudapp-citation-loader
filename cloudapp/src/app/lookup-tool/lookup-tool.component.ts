import { Component, OnInit } from '@angular/core';
import { LookUpService } from './lookup-service.service';
import {
  AlertService,
  CloudAppRestService,
  CloudAppSettingsService,
  RestErrorResponse,
  CloudAppEventsService,
} from "@exlibris/exl-cloudapp-angular-lib";
import * as XLSX from 'xlsx'; // Import XLSX library
import { forkJoin, of, from } from 'rxjs';
import { Router } from '@angular/router';
import { catchError, finalize, map, concatMap, tap } from 'rxjs/operators';

@Component({
  selector: 'app-lookup-tool',
  templateUrl: './lookup-tool.component.html',
  styleUrls: ['./lookup-tool.component.scss']
})
export class LookupToolComponent implements OnInit {
  courseData: any[] = [];
  progressBarValue: number = 0;
  files: File[] = [];
  arrayBuffer:any;
  loading: Boolean;
  
  constructor(
    private lookUpService: LookUpService,
    private restService: CloudAppRestService,
    private eventsService: CloudAppEventsService
  ) {}

  ngOnInit(): void {
    // Initialize component, if needed
  }

  onSelect(event) {
    this.files.push(...event.addedFiles);
  }

  onRemove(event) {
    this.files.splice(this.files.indexOf(event), 1);
  } 

  handleUpload(): void {
    

    let fileReader = new FileReader();
    let results =[];

    fileReader.onload = (e) => {

      this.arrayBuffer = fileReader.result;
        var data = new Uint8Array(this.arrayBuffer);
        var arr = new Array();
        for(var i = 0; i != data.length; ++i) arr[i] = String.fromCharCode(data[i]);
        var bstr = arr.join("");
        var workbook = XLSX.read(bstr, {type:"binary", cellStyles: true, codepage: 65001 });
        var first_sheet_name = workbook.SheetNames[0];
        var worksheet = workbook.Sheets[first_sheet_name];
        //let courseIds = new Array();

        let items: any[] =XLSX.utils.sheet_to_json(worksheet,{defval:"", skipHidden: true});
        
          // Collect all existing keys
          items = items.map(row => {
          const updatedRow = {}; // Create a new object to store updated keys and values
        
          Object.keys(row).forEach(key => {
              const trimmedKey = key.trim();  // Trim the key
           
              updatedRow[trimmedKey] = row[key]; // Add to the updated row with trimmed key
          });
      
          return updatedRow; // Replace the original row with the updated row
      });
        
        this.processRows(items);
       
    } 

    fileReader.readAsArrayBuffer(this.files[0]);

    
  }

  processFile(data: any): void {
    const workbook = XLSX.read(data, { type: 'binary' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    let json: any[] = XLSX.utils.sheet_to_json(worksheet);

   

    // Collect all existing keys
    json = json.map(row => {
      const updatedRow = {}; // Create a new object to store updated keys and values
    
      Object.keys(row).forEach(key => {
          const trimmedKey = key.trim();  // Trim the key
          
          updatedRow[trimmedKey] = row[key]; // Add to the updated row with trimmed key
      });
  
      return updatedRow; // Replace the original row with the updated row
  });
    this.processRows(json);
  }

  
processRows(json: any[]): void {
  this.courseData = [];
  let totalCitations = json.length;
  let processedCitations = 0;
  this.loading = true;
  console.log(JSON.stringify(json));

  from(json).pipe(
    concatMap(row => this.lookUpService.handleRequest(this.processRow(row)).pipe(
      tap(result => {
        this.courseData.push(...result);  // Push all combined results into courseData
        processedCitations++;
        this.progressBarValue = (processedCitations / totalCitations) * 100;
      }),
      catchError(error => {
        console.error('Error processing row:', error);
        return of(null);
      })
    )),
    finalize(() => {
      this.generateExcel();  // Generate Excel after all rows are processed
    })
  ).subscribe();
}


  processRow(row: any): any {
    const authorFirst = row['Author First'] || '';
    const authorLast = row['Author Last'] || '';
    const contributorFirst = row['Contributor First'] || '';
    const contributorLast = row['Contributor Last'] || '';
    const title = row['Title'] || '';
    const publisher = row['Publisher'] || '';
    const year = row['Year'] || '';
    const courseNumber = row['Course Number'] || '';
    const courseSemester = row['Course Semester'] || '';
    const instructor = row['Instructor Last Name'] || '';
    let format = row['Format'] || row['format'] || '';

    // Remove original keys
    delete row['Author First'];
    delete row['Author Last'];
    delete row['Contributor First'];
    delete row['Contributor Last'];
    delete row['Title'];
    delete row['Publisher'];
    delete row['Year'];
    delete row['Course Number'];
    delete row['Course Semester'];
    delete row['Instructor Last Name'];
    delete row['Format'];
    delete row['format'];

    // Create a new processed row
    let c_row = {
      'Author First - Input': authorFirst,
      'Author Last - Input': authorLast,
      'Contributor First - Input': contributorFirst,
      'Contributor Last - Input': contributorLast,
      'Title - Input': title,
      'Publisher - Input': publisher,
      'Year - Input': year,
      'Course Number - Input': courseNumber,
      'Course Semester - Input': courseSemester,
      'Instructor Last Name - Input': instructor,
      'Format - Input': format
    };

    // Add any extra columns
    for (const k in row) {
      if (!c_row.hasOwnProperty(k)) {
        if (row.hasOwnProperty(k)) {
          c_row[k] = row[k];
        }
      }
    }

    return c_row;
  }

  sendDataToLookUpService(): void {
    // Now that courseData is populated, generate the Excel file
    if (this.courseData.length > 0) {
      this.generateExcel(); // Generate the output Excel file
    } else {
      console.error('No data to generate Excel.');
    }
  }
  
  generateExcel(): void {
    let data = [];
   
    console.log(JSON.stringify(this.courseData));
    //console.log(JSON.stringify(this.courseData))
    if (this.courseData != null && this.courseData != undefined && this.courseData.length > 1) {
      //console.log("true")
        this.courseData.forEach(result => {
            let title, author, publisher, date, mms_id, isbn, version, course_name, course_code, course_section, course_instructor, library, library_location, call_number, barcode, description, format;

            if (result['Title']) {
                title = result['Title'];
            }

            if (result['Author']) {
                author = result['Author'];
            }

            if (result['Publisher']) {
                publisher = result['Publisher'];
            }

            if (result['Date']) {
                date = result['Date'];
            }

            if (result['MMS ID']) {
                mms_id = result['MMS ID'];
            }

            if (result['ISBN']) {
                isbn = result['ISBN'];
            }

            if (result['Version']) {
                version = result['Version'];
            }

            if (result['Course Name']) {
              course_name = result['Course Name'];
            }

            if (result['Course Code']) {
                course_code = result['Course Code'];
            }

            if (result['Course Section']) {
                course_section = result['Course Section'];
            }

            if (result['Library']) {
                library = result['Library'];
            }

            if (result['Location']) {
                library_location = result['Location'];
            }

            if (result['Call Number']) {
                call_number = result['Call Number'];
            }

            if (result['Barcode']) {
                barcode = result['Barcode'];
            }

            if (result['Description']) {
                description = JSON.stringify(result['Description']);
            }

            if (result['Returned Format']) {
                format = result['Returned Format'];
            }

            let row = {
                'Title': title,
                'Author': author,
                'Publisher': publisher,
                'Date': date,
                'MMS ID': mms_id,
                'ISBN': isbn,
                'Version': version,
                'Course Name': course_name,
                'Course Code': course_code,
                'Course Section': course_section,
                'Course Instructor': course_instructor,
                'Returned Format': format,
                'Library': library,
                'Location': library_location,
                'Call Number': call_number,
                'Barcode': barcode,
                'Description': description,
                'Citation Type': '',
                'Section Info': result['section_info'] || '',
                'Item Policy': result['item_policy'] || result['Item Policy'] || ''
            };

            var newValues = {};
            for (var k in result) {
                if (!(row.hasOwnProperty(k)) && k != "Description") {
                    if (result.hasOwnProperty(k)) {
                        newValues[k] = result[k];
                    }
                }
            }

            var newRow = Object.assign(newValues, row);
           // console.log(JSON.stringify(newRow));
            data.push(newRow);
        });
    } else {
        // Handling the case where there's only one result
        let title, author, publisher, date, mms_id, isbn, version, course_name, course_code, course_section, course_instructor, library, library_location, call_number, barcode, description, format;

        let result = this.courseData[0]; // Assuming the first and only entry

        if (result['Title']) {
            title = result['Title'];
        }

        if (result['Author']) {
            author = result['Author'];
        }

        if (result['Publisher']) {
            publisher = result['Publisher'];
        }

        if (result['Date']) {
            date = result['Date'];
        }

        if (result['MMS ID']) {
            mms_id = result['MMS ID'];
        }

        if (result['ISBN']) {
            isbn = result['ISBN'];
        }

        if (result['Version']) {
            version = result['Version'];
        }

        if (result['Course Name']) {
          course_name = result['Course Name'];
        }

        if (result['Course Code']) {
            course_code = result['Course Code'];
        }

        if (result['Course Section']) {
            course_section = result['Course Section'];
        }

        if (result['Course Instructor']) {
          course_instructor = result['Course Instructor'];
        }

        if (result['Library']) {
            library = result['Library'];
        }

        if (result['Location']) {
            library_location = result['Location'];
        }

        if (result['Call Number']) {
            call_number = result['Call Number'];
        }

        if (result['Barcode']) {
            barcode = result['Barcode'];
        }

        if (result['Description']) {
            description = JSON.stringify(result['Description']);
        }

        if (result['Returned Format']) {
            format = result['Returned Format'];
        }

        let row = {
            'Title': title,
            'Author': author,
            'Publisher': publisher,
            'Date': date,
            'MMS ID': mms_id,
            'ISBN': isbn,
            'Version': version,
            'Course Name': course_name,
            'Course Code': course_code,
            'Course Section': course_section,
            'Course Instructor': course_instructor,
            'Returned Format': format,
            'Library': library,
            'Location': library_location,
            'Call Number': call_number,
            'Barcode': barcode,
            'Description': description,
            'Citation Type': '',
            'Section Info': '',
            'Item Policy': ''
        };

        var newValues = {};
        for (var k in result) {
            if (!(row.hasOwnProperty(k)) && k != "Description") {
                if (result.hasOwnProperty(k)) {
                    newValues[k] = result[k];
                }
            }
        }

        var newRow = Object.assign(newValues, row);
   
        data.push(newRow);
    }

    this.loading = false;
    // Generate the Excel file with the collected data
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');

    // Write the file
    XLSX.writeFile(wb, 'output.xlsx');
}

}
