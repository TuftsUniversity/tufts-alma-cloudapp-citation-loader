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
import { forkJoin, of } from 'rxjs';
import { Router } from '@angular/router';
import { catchError, finalize, map } from 'rxjs/operators';

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

  handleUpload(event: any): void {
    

    let fileReader = new FileReader();
    let results =[];

    fileReader.onload = (e) => {

      this.arrayBuffer = fileReader.result;
        var data = new Uint8Array(this.arrayBuffer);
        var arr = new Array();
        for(var i = 0; i != data.length; ++i) arr[i] = String.fromCharCode(data[i]);
        var bstr = arr.join("");
        var workbook = XLSX.read(bstr, {type:"binary", cellStyles: true });
        var first_sheet_name = workbook.SheetNames[0];
        var worksheet = workbook.Sheets[first_sheet_name];
        //let courseIds = new Array();

        let items: any[] =XLSX.utils.sheet_to_json(worksheet,{defval:"", skipHidden: true});
        this.processRows(items);
        items.forEach(citation => {
          console.log(JSON.stringify(citation))
        });
        //var data = new Uint8Array(this.arrayBuffer);
        //var arr = new Array();
        //for(var i = 0; i != data.length; ++i) arr[i] = String.fromCharCode(data[i]);
        //var bstr = arr.join("");
        //var workbook = XLSX.read(bstr, {type:"binary", cellStyles: true });
        //var first_sheet_name = workbook.SheetNames[0];
        //var worksheet = workbook.Sheets[first_sheet_name]; 
    } 

    fileReader.readAsArrayBuffer(this.files[0]);

    
  }

  processFile(data: any): void {
    const workbook = XLSX.read(data, { type: 'binary' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const json: any[] = XLSX.utils.sheet_to_json(worksheet);

    this.processRows(json);
  }

  processRows(json: any[]): void {
    this.courseData = [];
    let totalCitations = json.length;
    let processedCitations = 0;

    json.forEach(row => {
      const processedRow = this.processRow(row);
      this.courseData.push(processedRow);

      // Update progress bar
      processedCitations++;
      this.progressBarValue = (processedCitations / totalCitations) * 100;
    });

    // After processing, send data using the LookUpService
    this.sendDataToLookUpService();
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
    this.courseData.reduce((promise, row) => {
      return promise.then(() => {
        // Call the LookUpService's handleRequest method instead of making an API call
        return this.lookUpService.handleRequest(row).toPromise()
          .then((response: any) => {
            console.log('Service response:', response);
          })
          .catch((error) => {
            console.error('Error:', error);
            alert('Error: ' + error.message);
          });
      });
    }, Promise.resolve()).then(() => {
      this.generateExcel();
    });
  }

  generateExcel(): void {
    const data = this.courseData.map((row: any) => {
      return {
        'Title': row['Title - Input'] || '',
        'Author': row['Author First - Input'] + ' ' + row['Author Last - Input'] || '',
        'Contributor': row['Contributor First - Input'] + ' ' + row['Contributor Last - Input'] || '',
        'Publisher': row['Publisher - Input'] || '',
        'Date': row['Year - Input'] || '',
        'Course Number': row['Course Number - Input'] || '',
        'Course Semester': row['Course Semester - Input'] || '',
        'Instructor Last Name': row['Instructor Last Name - Input'] || '',
        'Format': row['Format - Input'] || ''
      };
    });

    //const ws = XLSX.utils.json_to_sheet(data, { cellText: true });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');

    const range = XLSX.utils.decode_range(ws['!ref']);
    let barcodeColIndex = -1;

    // Find and fix Barcode column formatting if present
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
      if (cell && cell.v === 'Barcode') {
        barcodeColIndex = C;
        break;
      }
    }
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: barcodeColIndex })];
      if (cell && cell.v) {
        cell.t = 's';
        cell.z = '@';
      }
    }

    // Write the file
    XLSX.writeFile(wb, 'output.xlsx');
  }
}
