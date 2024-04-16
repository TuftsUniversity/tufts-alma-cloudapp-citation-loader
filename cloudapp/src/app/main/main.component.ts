import { from, of, combineLatest, Observable, iif, forkJoin } from 'rxjs';
import { tap , concatMap, switchMap, flatMap, toArray, mergeAll, map, catchError, finalize, mergeMap} from 'rxjs/operators';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { RestErrorResponse } from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateService } from '@ngx-translate/core';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';
import { saveAs } from 'file-saver-es';

import { ItemService } from './item.service';
import {JSONPath} from 'jsonpath-plus';


@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit, OnDestroy {
  files: File[] = [];
  previousCourseEntry = new Array();
  previousReadingListEntry  = new Array();
  // this has the same value as the course code but is used for tracking
  // reading lists, if they are the same as the previous so processing can be skipped
  previousReadingListCourseCode = new Array();
  loading = false;
  arrayBuffer:any;
  courseProcessed = 0;
  rLProcessed = 0;
  resultMessage = '';
  courseMMSIdInput = '';
  course_code = "";
  courses: any;
  reading_lists: any;
  private log = (str: string) => this.resultMessage += str+'\n';  
  

  constructor(
    private itemService: ItemService,
    private translate: TranslateService,
    
    
  ) { }

  ngOnInit() {
    
  }

  ngOnDestroy(): void {
  }

  onSelect(event) {
    this.files.push(...event.addedFiles);
  }

  onRemove(event) {
    this.files.splice(this.files.indexOf(event), 1);
  } 
  
  loadExecl() {
    
    this.loading = true;
    this.courseProcessed = 0;
    let fileReader = new FileReader();
    let results =[];
    let courseIds =[]
    let resultsRL =[];
    this.resultMessage = '';
    fileReader.onload = (e) => {
        this.arrayBuffer = fileReader.result;
        var data = new Uint8Array(this.arrayBuffer);
        var arr = new Array();
        for(var i = 0; i != data.length; ++i) arr[i] = String.fromCharCode(data[i]);
        var bstr = arr.join("");
        var workbook = XLSX.read(bstr, {type:"binary"});
        var first_sheet_name = workbook.SheetNames[0];
        var worksheet = workbook.Sheets[first_sheet_name];
        let courseIds = new Array();
        let courseId = "";
        // let updatedItems = new Array();
        let course_code = "Course Code"
        let mms_id = "MMS ID"
        let items: any[] =XLSX.utils.sheet_to_json(worksheet,{defval:""});
        items = items.sort((a, b) => {
          if (a.course_code < b.course_code) {
            return -1;
          }
        });
        // console.log("Confirm ordering")
        // console.log(JSON.stringify(items));
        let count = 0;
        // this.previousEntry.push(["0","0","0","0"]);
        from(items).pipe(
          concatMap(item => this.itemService.processUser(item, this.previousCourseEntry, this.courseProcessed).pipe(
            tap((userResult) => this.previousCourseEntry.push(userResult)),
            concatMap(userResult => {
              //console.log(`${JSON.stringify(this.previousCourseEntry)}`)
              // Implement your conditional logic here
              let reading_list_id: string;
              let reading_list_name: string;
              //console.log(userResult);

                let course_code:string;
                let mms_id: string;
              if ('course_code' in item){

                course_code = item.course_code;
              }

              else{

                course_code = item['Course Code'].replace(/[\{\}"']/g, "");
              }
              
              
              if ('mms_id' in item){

                mms_id = item.mms_id
              }

              else{
              let mms_id = item['MMS ID'].replace(/[\{\}"']/g, "");
              }
              

            
              let course_id: string;
              
              let barcode: string;
              if ('barcode' in item){

                barcode = item.barcode;
              }

              else if ('Barcode' in item){

                barcode = item.Barcode.replace(/[\{\}"']/g, "");
              }
              

              let citation_type: string = item.citation_type;
              let reserves_library: string = item.temporary_library;
              let reserves_location: string = item.temporary_location;
              let response = userResult[0];  
            
              let valid = false;
              
              if ('course' in userResult) {
                
                course_code = userResult.course[0].code;
                course_id = userResult.course[0].id;
                //reading_list_id = userResult[0].reading_list[0].id;
                //reading_list_name = userResult[0].reading_list[0].id;
                valid = true;
                //console.log(userResult);
                return forkJoin([of(valid), of(userResult), of(userResult), of(course_id), of(mms_id), of(course_code), of(barcode), of(reserves_library), of(reserves_location), of(citation_type)])//, this.itemService.getCitations(reading_list_id, course_id), of(barcode), of(citation_type), of(reserves_library), of(reserves_location)])

                              } 
                                           
              else{
                
                valid = false;
                let dummyCourse = userResult;
                return forkJoin([of(valid), of(userResult), of(dummyCourse), of(course_id), of(mms_id), of(course_code), of(barcode), of(reserves_library), of(reserves_location), of(citation_type)])//, of(dummyCitations), of(barcode), of(citation_type), of(reserves_library), of(reserves_location)])

              
              }
            }),

            concatMap(courses => {

              
              let course = courses[1];
              let course_id = courses[3];
              let mms_id = courses[4];
              let course_code = courses[5]
              let barcode = courses[6]
              let reserves_library = courses[7]
              let reserves_location = courses[8]
              let citation_type = courses[9]
              //console.log(JSON.stringify(courses))

              if ('course' in course){
                //console.log("course in courses")
                  let valid = true
            //}
                return forkJoin([of(valid), of(course), this.itemService.readingListLookup(course, course_code, course_id, this.previousReadingListCourseCode, this.previousReadingListEntry, this.rLProcessed, valid), of(course_id), of(mms_id), of(course_code), of(barcode), of(reserves_library), of(reserves_location), of(citation_type)])
              }



              else{
                let valid = false
                return forkJoin([of(valid), of(course), this.itemService.readingListLookup(course, course_code, course_id, this.previousReadingListCourseCode, this.previousReadingListEntry, this.rLProcessed, valid), of(course_id), of(mms_id), of(course_code), of(barcode), of(reserves_library), of(reserves_location), of(citation_type)])

              }
            }),
            tap((reading_list_object) => {
              console.log(JSON.stringify(reading_list_object))  
              console.log(JSON.stringify(this.previousReadingListEntry))
              this.previousReadingListEntry.push(reading_list_object[2])
            
            }),
          tap((reading_list_object) => {this.previousReadingListCourseCode.push(reading_list_object[5])}), 
            concatMap(reading_list => {
              let reading_list_object = reading_list[2]
              
              console.log(this.previousReadingListEntry[this.previousReadingListEntry.length  -1]);
              //console.log(JSON.stringify(reading_list))
              let valid = reading_list[0]
              let courses = reading_list[1]
              let course_code = reading_list[5];
              let course_id = reading_list[3];
              let mms_id  = reading_list[4];
              
              let barcode = reading_list[6]
              let reserves_library = reading_list[7]
              let reserves_location = reading_list[8]
              let citation_type = reading_list[9]
              //console.log(reading_list_object)
              if ('reading_list' in reading_list[2]) {
                let reading_list_id = reading_list[2]['reading_list'][0]['id'];
                let reading_list_name = reading_list[2]['reading_list'][0]['name'];
                let valid = true;
                let reading_list_valid = true;
                return forkJoin([of(valid), of(courses), of(reading_list_object), of(course_id), of(mms_id), of(course_code), this.itemService.getCitations(reading_list_id, course_id), of(barcode), of(reserves_library), of(reserves_location) , of(citation_type), of(reading_list_valid)])

                                          } 
                                                     
              else{
                
                
                let reading_list_valid = false;
                let dummyCitations = courses
                return forkJoin([of(valid), of(courses), of(reading_list_object), of(course_id), of(mms_id), of(course_code), of(dummyCitations), of(barcode), of(reserves_library), of(reserves_location) , of(citation_type), of(reading_list_valid)])

              
              }
                          
                          
              
            }),
             
            // })
              
            //   if ('reading_list' in userResult[0]) {
            //     course_code = userResult[2].course[0].code;
            //     course_id = userResult[2].course[0].id;
            //     reading_list_id = userResult[0].reading_list[0].id;
            //     reading_list_name = userResult[0].reading_list[0].id;
            //     valid = true;
            //     return forkJoin([of(valid), of(userResult), of(reading_list_id), of(course_id), of(mms_id), of(course_code), this.itemService.getCitations(reading_list_id, course_id), of(barcode), of(citation_type), of(reserves_library), of(reserves_location)])

            //                   } 
                                           
            //   else{
                
            //     valid = false;
            //     let dummyCitations = userResult;
            //     return forkJoin([of(valid), of(userResult), of(reading_list_id), of(course_id), of(mms_id), of(course_code), of(dummyCitations), of(barcode), of(citation_type), of(reserves_library), of(reserves_location)])

              
            //   }
              
              // Return the prepared data for the next step
              
            // }),
            
            concatMap(object => {
            
            let valid = object[0];
            let courses = object[1];
            let reading_list_object  = object[2];
            let course_id = object[3];
            let mms_id = object[4];
            let course_code = object[5];
            let citations: any = object[6];
            let reserves_library = object[7];
            let reserves_location = object[8];
            let barcode = object[9];
            let citation_type = object[10];
            let reading_list_valid = object[11]


            let mmsIdArray = new Array();
            if (valid && reading_list_valid){

              if ('citation' in citations){
              citations['citation'].forEach(citation => {
                if ('metadata' in citation){
                  if ('mms_id' in citation['metadata']){
 
                    mmsIdArray.push(citation['metadata']['mms_id'])
                  }

                }
              })
            }
                

                if(!(mmsIdArray.includes(mms_id))){
              return this.itemService.addToList(reading_list_object['reading_list'][0]['id'], course_id, mms_id, citation_type).pipe(
                concatMap(response_citation => {
                  
                  let exists = false;
                  return forkJoin([of(valid), of(courses), of(reading_list_object), of(response_citation), of(mms_id), of(course_code), of(exists), of(barcode), of(reserves_library), of(reserves_location), of(citation_type), of(reading_list_valid)]) // The response from addToList
                  //reading_list_id, // Keep the original reading_list_id
                  //course_id, // Keep the original course_id
                  //mms_id, // Keep the original mms_id
                  //course_code
              }),
                catchError(error => {
                  // Handle error, you might want to include the IDs in the error as well
                  let exists = false
                  return forkJoin([of(valid), of(courses), of(reading_list_object), of(error), of(mms_id), of(course_code), of(exists), of(barcode), of(reserves_library), of(reserves_location), of(citation_type), of(reading_list_valid) ]) // The response from addToList
                })
              )
            }

            else{
              let exists = true;
              let userResult1 = object;
              return forkJoin([of(valid), of(courses), of(reading_list_object), of(citations), of(mms_id), of(course_code), of(exists), of(barcode), of(reserves_library), of(reserves_location), of(citation_type), of(reading_list_valid)]) // The response from addToList
              

            }

            
          

              
              

          }

          else{
              let exists = false
              let userResult1 = object;
              return forkJoin([of(valid), of(courses), of(reading_list_object), of(citations), of(mms_id), of(course_code), of(exists), of(barcode), of(reserves_library), of(reserves_location),  of(citation_type), of(reading_list_valid)]);
              

            
          }
          }), 
          concatMap(object => {
            //console.log(JSON.stringify(object));
            let valid = object[0];
            let courses = object[1];
            let reading_list_object  = object[2];
            let citations = object[3];
            let mms_id = object[4];
            let course_code = object[5];
            let exists: any = object[6];
            //let exists: boolean = object[7];
            let barcode: string = object[7];
            //let citation_type = object[8];
            let reserves_library = object[8];
            let reserves_location = object[9];
            let citation_type = object[10];
            let reading_list_valid = object[11]
            let item_move_valid: boolean = false;


           //console.log(`${JSON.stringify(object)}`);
            if (valid == true && reading_list_valid == true && exists == false && barcode && reserves_library && reserves_location){
       

              return this.itemService.updateItem(barcode, reserves_library, reserves_location).pipe(

                concatMap(item => {
                  
                  if ('error' in item){
                    item_move_valid = false;
                    return forkJoin([of(valid), of(courses), of(reading_list_object), of(citations), of(mms_id), of(course_code), of(exists), of(barcode), of(reserves_library), of(reserves_location), of(item_move_valid), of(reading_list_valid)]);

                  }
                  else{
                    item_move_valid = true;
                  return forkJoin([of(valid), of(courses), of(reading_list_object), of(citations), of(mms_id), of(course_code), of(exists), of(barcode), of(reserves_library), of(reserves_location), of(item_move_valid), of(reading_list_valid)]);
                  }
                })
              )
            }

            else {
              //return forkJoin([of(valid), of(userResult), of(userResult1), of(reading_list_id), of(course_id), of(mms_id), of(course_code), of(barcode), of(citation_type), of(reserves_library), of(reserves_location), of(userResult1)]);
                return forkJoin([of(valid), of(courses), of(reading_list_object), of(citations), of(mms_id), of(course_code), of(exists), of(barcode), of(reserves_library), of(reserves_location), of(item_move_valid), of(reading_list_valid)]);

            }


          }
            ),

          
          toArray(),
          
          tap(() => this.courseProcessed++),
          tap(() => this.rLProcessed++)
        //Collect all results into an array
          
          )))
        // s.pipe(mergeMap(obs=>obs, 1))
        .subscribe({
          next: result => results.push(result),
          complete: () => {
            setTimeout(() => {
             
              let successCount = 0, errorCount = 0, skippedCount = 0; 
              let updatedItems = new Array();
              let errorSummary = '';
              let skippedSummary = '';
             
              results.forEach(res => {
                //console.log(`${JSON.stringify(res)}`)
               
               
                
                if(res[0][0] == false){
                  errorCount++;
                  //errorSummary += `Error for course ${res[0][6]} and MMS ID ${res[0][5]}: ${res[0][1][2].data}\n`

                  errorSummary += `Error for course ${res[0][5]}\n`

                    
                }



                else if (res[0][11] == false){
                  if (res[0][2].length > 1){
                    if (res[0][2][1] == "more_than_one_reading_list"){
                      errorCount++;
                      errorSummary += `More than one reading list for course ${res[0][5]} and MMS ID ${res[0][4]}\n`
    
                    }


                  }

                  else{
                  errorCount++;
                  errorSummary += `Error in reading list for course ${res[0][5]} and MMS ID ${res[0][4]} ${res[0][2].message}\n`

                  }
                }

                // else if (res[0][11] == false){
                //   errorCount++;
                //   errorSummary += `Error for course ${res[0][5]} and MMS ID ${res[0][4]} ${res[0][2].message}\n`

                  
                // }
                else if('error' in res[0][3]){

                  errorCount++;
                  errorSummary += `Bad MMS ID for course ${res[0][5]} and MMS ID ${res[0][4]} : ${res[0][3].message}\n`



                }

                

                else if(res[0][6] == true){

                  skippedCount++;
                  skippedSummary += `citation already exists for course ${res[0][5]} and MMS ID ${res[0][5]}\n`


                }
  
                else{
                  if (res[0][10] == true){
                    updatedItems.push("course code: " + JSON.stringify(res[0][5])  + ", reading list: " + JSON.stringify(res[0][2].reading_list[0].name) + "MMS ID: " + res[0][4] + `citation: ${JSON.stringify(res[0][3].id)} - Item with barcode ${res[0][7]} now in location ${res[0][9]} in library ${res[0][8]} \n`);
                    successCount++;
                  }
                  else{
                  updatedItems.push("course code: " + JSON.stringify(res[0][5])  + ", reading list: " + JSON.stringify(res[0][2].reading_list[0].name) + "MMS ID: " + res[0][4] + `citation: ${JSON.stringify(res[0][3].id)}\n`);
                  successCount++;
                  }
                }
                });

                let str1 = `${this.translate.instant("Main.Processed")}: ${this.courseProcessed}\n`;
                let str2 =  `${this.translate.instant("Main.Updated")}: ${successCount}\n`;
                let str3 = `Skipped: ${skippedCount}\n`;
                let str4 = `Errors:\n ${errorSummary}\n`;
                let str5 = `Skipped: \n${skippedSummary}\n`;
                let str6 = `${this.translate.instant("Main.ProcessedItems")}:\n ${updatedItems.join(", ")}\n`;

                this.log(`${this.translate.instant("Main.Processed")}: ${this.courseProcessed}`);
                this.log(`${this.translate.instant("Main.Updated")}: ${successCount}`);
                this.log(`Number of skipped records: ${skippedCount}`);
                this.log(`${this.translate.instant("Main.Failed")}: ${errorCount}`+'\n');
                if(errorSummary){
                  this.log(`Errors:\n ${errorSummary}`);
                }
                if(skippedSummary){
                  this.log(`Skipped: \n${skippedSummary}`);
                }
                if(updatedItems){
                  this.log(`${this.translate.instant("Main.ProcessedItems")}:\n ${updatedItems.join(", ")}`);
                }
                

                 
                this.loading = false;
                
                this.files= [];
                
                
                //let file = new Blob([str1 + str2 + str3 + str4 + str5 + str6], {type: 'text/plain'});
               
                let file = str1 + str2 + str3 + str4 + str5 + str6;
                //console.log(file);
                //let file = new File([str1 + str2 + str3 + str4 + str5 + str6 ], "log report.txt", {type: "text/plain;charset=utf-8"});
                // saveAs(str1 + str2 + str3 + str4 + str5 + str6, 'log.txt');
                //var blob = new Blob(["Hello, world!"], {type: "text/plain;charset=utf-8"});
                // FileSaver.saveAs(file);

                // let reader = new FileReader();
                // let blob = new Blob([str1 + str2 + str3 + str4 + str5 + str6], {type: 'text/plain'});
                // reader.readAsDataURL(blob);
                // FileSaver.saveAs(blob)
                // var a = document.createElement('a');
                // a.href = file.toDataURL();
                // a.download = 'screen.png';
                // a.target='blank';
                // a.click();   

                // var reader = new FileReader();
                var blob = new Blob(['Hello world'], {type: 'text/plain'});
                // // reader.onload = function(e){
                // //   window.location.href = reader
                // // }
                // reader.readAsDataURL(blob);
                //const file = new Blob(["Hello, file!"], { type: "text/plain" });
//                 const url = window.URL.createObjectURL(blob);

//                 const fs = require('fs')
 
// // Data which will write in a file.
//                 let data = "Learning how to write in a file."
                
//                 // Write data in 'Output.txt' .
//                 fs.writeFile('Output.txt', file, (err) => {
                
//                     // In case of a error throw err.
//                     if (err) throw err;
//                 })
//                 FileSaver.saveAs(fs, "log_report.txt");
                // // window.URL.revokeObjectURL(url);
                // var printWindow = window.open();
            
                // printWindow.document.open('text/plain');
                // printWindow.document.write(file);
                // printWindow.print();
                // printWindow.document.close();
                // let myWindow = window.open('/', '_blank', 'noopener');
                // var link = document.createElement('a');
                // link.setAttribute('target', '_blank');
                // link.href = window.URL.createObjectURL(file);
                // link.click(); 

                // // a.target = '_blank';
                // a.setAttribute('target', '_blank');
                // a.href = window.document.createObjectURL(file);
                // a.click();
                // var tab = window.open('about:blank', '_blank');
                //tab.document.write('<p>' + file + '</p>'); // where 'html' is a variable containing your HTML
                //tab.document.close(); // to finish loading the page
               
                
              }, 500);
             


        }
        })
        
        
    }
    fileReader.readAsArrayBuffer(this.files[0]);
       
}
print(data){
  console.log(data)
  let file = new Blob([data], {type: 'text/plain'});
  saveAs(file, "Log Export.txt");

}

}

const isRestErrorResponse = (object: any): object is RestErrorResponse => 'error' in object;