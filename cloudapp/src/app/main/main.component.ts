import { from, of, combineLatest, Observable, iif, forkJoin, Subscription  } from 'rxjs';
import { tap , concatMap, switchMap, flatMap, toArray, mergeAll, map, catchError, finalize, mergeMap} from 'rxjs/operators';
import { Component, OnInit, OnDestroy,ViewChild } from '@angular/core';
import { RestErrorResponse, CloudAppRestService, HttpMethod,CloudAppSettingsService, CloudAppEventsService, PageInfo} from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateService } from '@ngx-translate/core';
import { Configuration } from "../models/configuration.model";
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';
import { saveAs } from 'file-saver-es';
import { Settings } from '../models/settings.model';

import { ItemService } from './item.service';
import {JSONPath} from 'jsonpath-plus';



@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit, OnDestroy {
  @ViewChild("drop", { static: false }) dropZone: any;
  private pageLoad$: Subscription;
  loadingConfig: boolean = false;
  isChecked: boolean;
  library: string;
  location: string;
  complete: boolean;
  config: Configuration;
  hasApiResult: boolean = false;
  private _apiResult: any;
  settings: Settings;
  files: File[] = [];
  counter: number = 0;
  loadingSettings: boolean = false;
  previousCourseEntry = new Array();
  previousReadingListEntry  = new Array();
  uniqueCompletedReadingLists = new Array();
  uniqueNonComplete = new Array();
  completeArray = new Array();
  // this has the same value as the course code but is used for tracking
  // reading lists, if they are the same as the previous so processing can be skipped
  previousReadingListCode = new Array();
  previousCourseCode = new Array();
  loading = false;
  arrayBuffer:any;
  courseProcessed = 0;
  rLProcessed = 0;
  resultMessage = '';
  completedReadingLists: number = 0;
  completedList = new Array();
  nonCompletedReadingLists = new Array();



  courseMMSIdInput = '';
  course_code = "";
  courses: any;
  reading_lists: any;
  private log = (str: string) => this.resultMessage += str+'\n';  
  

  constructor(
    private itemService: ItemService,
    private translate: TranslateService,
    private restService: CloudAppRestService,
    private settingsService: CloudAppSettingsService,
    private eventsService: CloudAppEventsService
    
    
  ) { }

  ngOnInit() {

    this.pageLoad$ = this.eventsService.onPageLoad(this.onPageLoad);
    this.settingsService.get().subscribe(settings => {
      this.settings = settings as Settings;
      if ((this.settings.library != "") && (this.settings.location != "")){
        this.loadingSettings = false;
      }else{
        this.loadingSettings = true;
      }

    this.isChecked = this.settings.isChecked;
    this.library = this.settings.library;
    this.location = this.settings.location;
    
    console.log(this.isChecked)
    console.log(this.location);
    });
    
  }

  ngOnDestroy(): void {
  }

  onSelect(event) {
    this.files.push(...event.addedFiles);
  }

  onRemove(event) {
    this.files.splice(this.files.indexOf(event), 1);
  } 
  
  get apiResult() {
    return this._apiResult;
  }

  set apiResult(result: any) {
    this._apiResult = result;
    this.hasApiResult = result && Object.keys(result).length > 0;
  }

  onPageLoad = (pageInfo: PageInfo) => {
  }
  loadExecl() {
    
    this.loading = true;
    this.courseProcessed = 0;
    let fileReader = new FileReader();
    let results =[];
    let courseIds =[]
    let resultsRL =[];
    this.resultMessage = '';
    console.log(this.isChecked)
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
    
          concatMap(item => this.itemService.processUser(item, this.previousCourseEntry, this.previousCourseCode, this.courseProcessed).pipe(
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

                course_code = item.course_code.replace(/[\{\}"']/g, "");
              }

              else{

                course_code = item['Course Code'].replace(/[\{\}"']/g, "");
              }
              
              
              if ('mms_id' in item){

                mms_id = item.mms_id.replace(/[\{\}"']/g, "");
              }

              else{
              mms_id = item['MMS ID'].replace(/[\{\}"']/g, "");
              }
              

            
              let course_id: string;
              
              let barcode: string;
              if ('barcode' in item){

                barcode = item.barcode;
              }

              else if ('Barcode' in item){

                barcode = item.Barcode.replace(/[\{\}"']/g, "");
              }
              
              let citation_type:string;

              if ('citation_type' in item){
                citation_type = item.citation_type;

              }

              else if ('Citation Type' in item){

                citation_type = item['Citation Type'];
              }

              else if ('secondary_type' in item){

                citation_type = item.secondary_type;
              }

              
              //let reserves_library: string = item.temporary_library;
              let reserves_library: string = this.library;
              
              //let reserves_location: string = item.temporary_location;
              let reserves_location: string = this.location;
              console.log(reserves_library);
              console.log(reserves_location);
              let response = userResult[0];  
            
              let valid = false;
              
              let reading_list_section: string;
              if ("section_info" in item){
                reading_list_section = item.section_info;
                
              }
              let course_section: string;
              let course_code_and_section: string;
              if ("Course Section" in item){
                if (item['Course Section'] != ""){
                
                course_section = item['Course Section'];
                course_code_and_section = course_code + "-" + course_section;
                //console.log(course_code_and_section);
                }
                
                else{

                  course_code_and_section = course_code;
                }
              }

              else if ('course_section' in item){

                if (item.course_section != ""){
                course_section = item['course_section'];
                course_code_and_section = course_code + "-" + course_section;
                //console.log(course_code_and_section);
                }
                else{

                  course_code_and_section = course_code;
                }
              }

              else{

                course_code_and_section = course_code;
              }
              if ('course' in userResult) {
                
                course_code = userResult.course[0].code;
                course_id = userResult.course[0].id;
                course_section = userResult.course[0].section;
                
                course_code_and_section = course_code + "-" + course_section;
              
                valid = true;
                //console.log(userResult);
                return forkJoin([of(valid), of(userResult), of(userResult), of(course_id), of(mms_id), of(course_code_and_section), of(barcode), of(reserves_library), of(reserves_location), of(citation_type), of(reading_list_section)])//, this.itemService.getCitations(reading_list_id, course_id), of(barcode), of(citation_type), of(reserves_library), of(reserves_location)])

                              } 
                                           
              else{
                
                valid = false;
                let dummyCourse = userResult;
                return forkJoin([of(valid), of(userResult), of(dummyCourse), of(course_id), of(mms_id), of(course_code_and_section), of(barcode), of(reserves_library), of(reserves_location), of(citation_type), of(reading_list_section)])//, of(dummyCitations), of(barcode), of(citation_type), of(reserves_library), of(reserves_location)])

              
              }
            }),
            tap((courses) => {this.previousCourseCode.push(courses[5])}),
            tap((courses) => {this.completeArray.push(courses)}),
            tap((courses =>  {
              //(JSON.stringify(this.completeArray));
              
              }
            )),
            concatMap(courses => {

              
              let course = courses[1];
              let course_id = courses[3];
              let mms_id = courses[4];
              let course_code_and_section = courses[5]
              let barcode = courses[6]
              let reserves_library = courses[7]
              let reserves_location = courses[8]
              let citation_type = courses[9]
              let reading_list_section = courses[10]
              console.log(JSON.stringify(course))

              if ('course' in course){
                console.log("course in courses")
                  let valid = true
            //}
                return forkJoin([of(valid), of(course), this.itemService.readingListLookup(course, course_code_and_section, course_id, this.previousReadingListCode, this.previousReadingListEntry, this.rLProcessed, valid), of(course_id), of(mms_id), of(course_code_and_section), of(barcode), of(reserves_library), of(reserves_location), of(citation_type), of(reading_list_section)])
              }



              else{
                let valid = false
                return forkJoin([of(valid), of(course), this.itemService.readingListLookup(course, course_code_and_section, course_id, this.previousReadingListCode, this.previousReadingListEntry, this.rLProcessed, valid), of(course_id), of(mms_id), of(course_code_and_section), of(barcode), of(reserves_library), of(reserves_location), of(citation_type), of(reading_list_section)])

              }
            }),
            tap((reading_list_object) => {
             // console.log(JSON.stringify(reading_list_object))  
             // console.log(JSON.stringify(this.previousReadingListEntry))
             // console.log(JSON.stringify(this.previousReadingListCode))
              this.previousReadingListEntry.push(reading_list_object[2])
              
            
            }),
          tap((reading_list_object) => {
          //  console.log(JSON.stringify(reading_list_object[5]))
            this.previousReadingListCode.push(reading_list_object[5])
            
           
          

            
        }), 
            concatMap(reading_list => {
              let reading_list_object = reading_list[2]
              
             // console.log(JSON.stringify(this.previousReadingListEntry))//[this.previousReadingListEntry.length  -1]);
              //console.log(JSON.stringify(reading_list))
              let valid = reading_list[0]
              let courses = reading_list[1]
              let course_code_and_section = reading_list[5];
              let course_id = reading_list[3];
              let mms_id  = reading_list[4];
              
              let barcode = reading_list[6]
              let reserves_library = reading_list[7]
              let reserves_location = reading_list[8]
              let citation_type = reading_list[9]
              let reading_list_section = reading_list[10]
              console.log(reading_list_object)

              let reading_list_id: string;
              let reading_list_name: string;
              if ('reading_list' in reading_list[2] || 'id' in reading_list[2]) {

                if ('reading_list' in reading_list[2]){
                reading_list_id = reading_list[2]['reading_list'][0]['id'];
                reading_list_name = reading_list[2]['reading_list'][0]['name'];

                }

                else if ('id' in reading_list[2]){
              reading_list_id = reading_list[2]['id'];
                reading_list_name = reading_list[2]['name'];

                }
                console.log(JSON.stringify(reading_list[2]))
                
                let valid = true;
                let reading_list_valid = true;
                return forkJoin([of(valid), of(courses), of(reading_list_object), of(course_id), of(mms_id), of(course_code_and_section), this.itemService.getCitations(reading_list_id, course_id), of(barcode), of(reserves_library), of(reserves_location) , of(citation_type), of(reading_list_valid), of(reading_list_section)])

                                          } 
                                                     
              else{
                
                
                
                let reading_list_valid = false;
                let dummyCitations = courses
                return forkJoin([of(valid), of(courses), of(reading_list_object), of(course_id), of(mms_id), of(course_code_and_section), of(dummyCitations), of(barcode), of(reserves_library), of(reserves_location) , of(citation_type), of(reading_list_valid), of(reading_list_section)])

              
              }
                          
                          
              
            }),
             
          
            tap((object) => {
              let reading_list_id: string;

              if ('reading_list' in object[2]){
                reading_list_id = object[2]['reading_list'][0]['id'];

              }
              
              else if ('id' in object[2]){

                reading_list_id = object[2]['id'];
              }
              try{

                reading_list_id = object[2]['reading_list'][0]['id'];
              }

              catch{
                reading_list_id = "";
              }
      
            
            }),
            concatMap(object => {
            let complete: boolean;

            
            let valid = object[0];
            let courses = object[1];
            let reading_list_object  = object[2];
            let course_id = object[3];
            let mms_id = object[4];
            let course_code_and_section = object[5];
            let citations: any = object[6];
            let barcode = object[7];
            let reserves_library = object[8];
            let reserves_location = object[9];
            
            let citation_type = object[10];
            let reading_list_valid = object[11]
            let reading_list_section = object[12]


            let mmsIdArray = new Array();
            let add_item_valid: boolean;


            console.log(this.isChecked)
                
                if (this.isChecked == true || barcode == "" || barcode == undefined){
                  complete = true;
                  

                }

                else{

                  complete = false;
                 
                }
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
             
              let reading_list_id: string;
              if('reading_list' in reading_list_object){
                reading_list_id = reading_list_object['reading_list'][0]['id'];

              }

              else if ('id' in reading_list_object){
                reading_list_id = reading_list_object['id'];

              }
              
                

                console.log(complete)
              return this.itemService.addToList(reading_list_id, course_id, mms_id, citation_type, reading_list_section, complete).pipe(
                concatMap(response_citation => {
                  add_item_valid = false;
                  let exists = false;
                  
                  return forkJoin([of(valid), of(courses), of(reading_list_object), of(response_citation), of(mms_id), of(course_code_and_section), of(exists), of(barcode), of(reserves_library), of(reserves_location), of(citation_type), of(reading_list_valid), of(reading_list_section), of(add_item_valid), of(complete)]) // The response from addToList
                  //reading_list_id, // Keep the original reading_list_id
                  //course_id, // Keep the original course_id
                  //mms_id, // Keep the original mms_id
                  //course_code

              }),
                catchError(error => {
                  // Handle error, you might want to include the IDs in the error as well
                  let exists = false;
                  add_item_valid = false;
                  return forkJoin([of(valid), of(courses), of(reading_list_object), of(error), of(mms_id), of(course_code_and_section), of(exists), of(barcode), of(reserves_library), of(reserves_location), of(citation_type), of(reading_list_valid), of(reading_list_section), of(add_item_valid), of(complete) ]) // The response from addToList
                })
              )
            }

            else{
              let exists = true;
              add_item_valid = true;
              let userResult1 = object;
              return forkJoin([of(valid), of(courses), of(reading_list_object), of(citations), of(mms_id), of(course_code_and_section), of(exists), of(barcode), of(reserves_library), of(reserves_location), of(citation_type), of(reading_list_valid), of(reading_list_section), of(add_item_valid), of(complete)]) // The response from addToList
              

            }

            
          

              
              

          }

          else{
            add_item_valid = false;
              let exists = false
              let userResult1 = object;
              return forkJoin([of(valid), of(courses), of(reading_list_object), of(citations), of(mms_id), of(course_code_and_section), of(exists), of(barcode), of(reserves_library), of(reserves_location),  of(citation_type), of(reading_list_valid), of(reading_list_section), of(add_item_valid), of(complete)]);
              

            
          }
          }), 
          
         
          concatMap(object => {
            //console.log(JSON.stringify(object));
            let valid = object[0];
            let courses = object[1];
            let reading_list_object  = object[2];
            let citations = object[3];
            let mms_id = object[4];
            let course_code_and_section = object[5];
            let exists: any = object[6];
            //let exists: boolean = object[7];
            let barcode: string = object[7];
            //let citation_type = object[8];
            let reserves_library = object[8];
            let reserves_location = object[9];
        
            let reading_list_valid = object[11];
            let reading_list_section = object[12];
            let add_item_valid = object[13];
            let complete = object[14];
            let item_move_valid: boolean = false;
            let moveable: boolean;

            if(reserves_library && reserves_location){
              moveable = true;
            }

            else{moveable = false}

            console.log(reserves_library + reserves_location)
           console.log(`${JSON.stringify(object)}`);
            if (valid == true && reading_list_valid == true && exists == false && barcode && reserves_library && reserves_location){
       

              return this.itemService.updateItem(barcode, reserves_library, reserves_location).pipe(

                concatMap(item => {
                  
                  if ('error' in item){
                    item_move_valid = false;
                    return forkJoin([of(valid), of(courses), of(reading_list_object), of(citations), of(mms_id), of(course_code_and_section), of(exists), of(barcode), of(reserves_library), of(reserves_location), of(item_move_valid), of(reading_list_valid), of(reading_list_section), of(add_item_valid), of(moveable), of(complete)]);

                  }
                  else{
                    item_move_valid = true;
                  return forkJoin([of(valid), of(courses), of(reading_list_object), of(citations), of(mms_id), of(course_code_and_section), of(exists), of(barcode), of(reserves_library), of(reserves_location), of(item_move_valid), of(reading_list_valid), of(reading_list_section), of(add_item_valid), of(moveable), of(complete)]);
                  }
                })
              )
            }

            else {
              //return forkJoin([of(valid), of(userResult), of(userResult1), of(reading_list_id), of(course_id), of(mms_id), of(course_code), of(barcode), of(citation_type), of(reserves_library), of(reserves_location), of(userResult1)]);
                return forkJoin([of(valid), of(courses), of(reading_list_object), of(citations), of(mms_id), of(course_code_and_section), of(exists), of(barcode), of(reserves_library), of(reserves_location), of(item_move_valid), of(reading_list_valid), of(reading_list_section), of(moveable), of(complete)]);

            }


          }
            ),
           

          
          toArray(),
         
        
          tap(() => this.courseProcessed++),
          tap(() => this.rLProcessed++)
        //Collect all results into an array
          
        )))
        


        
        
          
         

          
        
        .subscribe({
          
          next: result => results.push(result),
          
          complete: () => {
            
            setTimeout(() => {
              
              var that = this;
              let successCount = 0, errorCount = 0, skippedCount = 0; 
              let updatedItems = new Array();
              
              
              let completedList = new Array();
              let completedReadingLists: number = 0;
              let errorSummary = '';
              let skippedSummary = '';
            // console.log(JSON.stringify(results))
              results.forEach(res => {
                //console.log(`${JSON.stringify(res)}`)
               
                let reading_list_section: string = "Resources";
                    if(res[0][12]){

                      reading_list_section = res[0][12];
                    }
               
                
                if(res[0][0] != true){
                  errorCount++;
                  //errorSummary += `Error for course ${res[0][6]} and MMS ID ${res[0][5]}: ${res[0][1][2].data}\n`

                  errorSummary += `Error for course ${res[0][5]}\n`
                  this.nonCompletedReadingLists.push(res[0][5]);
                    
                }



                else if (res[0][11] == false){
                  if (res[0][2].length > 1){
                    if (res[0][2][1] == "more_than_one_reading_list"){
                      errorCount++;
                      errorSummary += `More than one reading list for course ${res[0][5]} and MMS ID ${res[0][4]}\n`
                      this.nonCompletedReadingLists.push(res[0][5]);
                    }
                    else{
                      errorCount++;
                      errorSummary += `Error in reading list for course ${res[0][5]} and MMS ID ${res[0][4]} ${res[0][2].message}\n`
                      this.nonCompletedReadingLists.push(res[0][5]);
                      }

                  }

                  else{
                    errorCount++;
                    errorSummary += `Error in reading list for course ${res[0][5]} and MMS ID ${res[0][4]} ${res[0][2].message}\n`
                    this.nonCompletedReadingLists.push(res[0][5]);
                    }
                }

                if (res[0][2][1] == "more_than_one_reading_list"){
                  errorCount++;
                  errorSummary += `More than one reading list for course ${res[0][5]} and MMS ID ${res[0][4]}\n`
                  this.nonCompletedReadingLists.push(res[0][5]);
                }

                // else if (res[0][11] == false){
                //   errorCount++;
                //   errorSummary += `Error for course ${res[0][5]} and MMS ID ${res[0][4]} ${res[0][2].message}\n`

                  
                // }
                else if('error' in res[0][3]){

                  errorCount++;
                  errorSummary += `Bad MMS ID for course ${res[0][5]} and MMS ID ${res[0][4]} : ${res[0][3].message}\n`
                  this.nonCompletedReadingLists.push(res[0][5]);


                }

                

                else if(res[0][6] == true){

                  skippedCount++;
                  skippedSummary += `citation already exists for course ${res[0][5]} and MMS ID ${res[0][5]}\n`


                }
  
                else{
                  let reading_list_id: string;
                    let reading_list_name: string;
                    if ('reading_list' in res[0][2]){
                      reading_list_id = res[0][2]['reading_list'][0]['id'];
                      reading_list_name =res[0][2]['reading_list'][0]['name'];
      
                      }
      
                      else if ('id' in res[0][2]){
                    reading_list_id = res[0][2]['id'];
                      reading_list_name = res[0][2]['name'];
      
                      }
                  if (res[0][10] == true){

                    
                    
                    updatedItems.push("course code: " + JSON.stringify(res[0][5])  + ", reading list: " + reading_list_name + ", section: " + JSON.stringify(reading_list_section) + ", MMS ID: " + res[0][4] + `citation: ${JSON.stringify(res[0][3].id)} - Item with barcode ${res[0][7]} now in location ${res[0][9]} in library ${res[0][8]} \n`);
                    successCount++;
                    


                  }

                  else if (res[0][8] && res[0][9] && res[0][10] == false){
                    if (res[0][8] != "" && res[0][9] != ""){
                      errorCount++;
                      errorSummary += `Error moving physical items for course ${res[0][5]} and MMS ID ${res[0][4]} to library ${res[0][8]} and location ${res[0][9]}\n`
                      this.nonCompletedReadingLists.push(res[0][5]);

                    }

                    else{
                      updatedItems.push("course code: " + JSON.stringify(res[0][5])  + ", reading list: " + reading_list_name + ", section: " + JSON.stringify(reading_list_section)+ ", MMS ID: " + res[0][4] + `citation: ${JSON.stringify(res[0][3].id)}\n`);
                      successCount++;
                    }

                  }
                  else if (res[0][0] != false && res[0][11]!= false && !('error' in res[0][3])){
                  updatedItems.push("course code: " + JSON.stringify(res[0][5])  + ", reading list: " + reading_list_name + ", section: " + JSON.stringify(res[0][12])+ ", MMS ID: " + res[0][4] + `citation: ${JSON.stringify(res[0][3].id)}\n`);
                  successCount++;
                  }

                  else{
                  errorSummary += `Error for course ${res[0][5]}\n`
                  this.nonCompletedReadingLists.push(res[0][5]);

                  }
                }
                });




                  //   let dataArray = [
                  //     {1: {course_identifier: "C101", valid: false, reading_list_valid: true, add_item_valid: true, moveable: false, item_move_valid: false}},
                  //     {2: {course_identifier: "C102", valid: true, reading_list_valid: false, add_item_valid: true, moveable: true, item_move_valid: true}},
                  //     {3: {course_identifier: "C103", valid: true, reading_list_valid: true, add_item_valid: true, moveable: false, item_move_valid: false}},
                  //     // more objects...
                  // ];
                  
                  
    
        
                  this.uniqueNonComplete = this.nonCompletedReadingLists.filter((item, i, ar) => ar.indexOf(item) === i);
                  

                //  console.log(JSON.stringify(this.uniqueNonComplete));
                  results.forEach(res => {

                    if (!this.uniqueNonComplete.includes(res[0][5]) && res[0][14] == true){
                    //  console.log("reading list object"); 
                      //console.log(JSON.stringify(res[0][2]));
                     // console.log("course valid")
                     // console.log([0][0]);
                     // console.log("item exists")
                     // console.log([0][6]);
                     // console.log("Add item valid")
                     // console.log([0][10]);
                    //  console.log("course code")
                    //  console.log(res[0][5])
                    //  console.log("reading list valid")
                   //   console.log(res[0][11]);
                    //  console.log("Move item valid")
                    //  console.log(res[0][13]);

                    let reading_list_id: string;
                    let reading_list_name: string;
                    if ('reading_list' in res[0][2]){
                      reading_list_id = res[0][2]['reading_list'][0]['id'];
                      reading_list_name =res[0][2]['reading_list'][0]['name'];
      
                      }
      
                      else if ('id' in res[0][2]){
                    reading_list_id = res[0][2]['id'];
                      reading_list_name = res[0][2]['name'];
      
                      }
                    //  console.log(`/courses/${res[0][1].course[0].id}/reading-lists/${res[0][2].reading_list[0].id}`);
                    //  console.log(this.uniqueCompletedReadingLists)
                      if (!this.uniqueCompletedReadingLists.includes(`/courses/${res[0][1].course[0].id}/reading-lists/${reading_list_id}`)){
                        try{
                     //   console.log(res[0][2]);

                        this.uniqueCompletedReadingLists.push(`/courses/${res[0][1].course[0].id}/reading-lists/${reading_list_id}`)
                        }catch{
                       //   let error = "error";
                        }
                      }
                    }
                  })

               
        
                  
                    
        
                    
        
                  
                    //var completeable = new Array()
                    
                    //for (var array in this.completeArray){
        
        
                    //}.
        
                  //   var invalid_array = this.completeArray.filter(function(e){
                  //     return (e.valid === false || e.reading_list_valid === false || e.add_item_valid === false ||(e.moveable === true && e.item_move_valid === false))
                  // })
        
                  // var invalid_courses = new Set(invalid_array.map(i => i.course_identifier));
                 
                  // var all_courses = new Set(this.completeArray.map(i => i.course_identifier));
        
                  // var valid_courses = all_courses.difference(invalid_courses);
                  // var valid
                  //   this.completeArray = filter(a => a.type == "ar");
                  //   this.itemService.completeReadingLists(this.completeArray)
                  //   return results;
        
                  //})
                


                
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

                
                

                this.completeReadingLists()
                
                 
                
                
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
                //let completedList = new Array();
               // console.log(JSON.stringify(this.uniqueCompletedReadingLists));
               
               
                
              }, 500);
             
             

        }        })

        

        


          

       
        
        
    }
    fileReader.readAsArrayBuffer(this.files[0]);
       
}

completeReadingLists(){

  let results = new Array();
      
  from(this.uniqueCompletedReadingLists).pipe(concatMap( url => this.itemService.completeReadingLists(url).pipe(
    
  
  
  ))).subscribe({
          
    next: result => results.push(result),
    
    complete: () => {
      
      setTimeout(() => {

      results.forEach(res => {
        this.completedReadingLists++;
        this.completedList.push(res['code']);
        console.log(JSON.stringify(this.completedList));
        console.log(JSON.stringify(this.completedReadingLists))
      })
        this.log(`${this.translate.instant("Number of Completed Reading Lists")}: ${this.completedReadingLists}`);
        this.log(`${this.translate.instant("Total Number of Non-Completed Reading Lists")}: ${this.uniqueNonComplete.length}`);
    if(this.completedList){
      this.log(`${this.translate.instant("Completed Reading Lists")}:\n ${this.completedList.join(", ")}`);
    }
    
    if (this.uniqueNonComplete){
      this.log(`${this.translate.instant("Non-Completed Reading Lists")}:\n ${this.uniqueNonComplete.join(", ")}`);
    }
    
        this.loading = false;
    


      }, 500)
      
      
    }
    
   
  })
     
     
    
}
      

  

print(data){
  console.log(data)
  let file = new Blob([data], {type: 'text/plain'});
  saveAs(file, "Log Export.txt");

}

// completeReadingLists(url: any){

//   return this.restService.call(url)
//     .pipe(catchError(e=> {throw (e)})
    
//     ,
//     switchMap(item => {

//       item['status'] = "Complete";
//       console.log(JSON.stringify(item));
//       return this.restService.call( {
//         url: url,
//         requestBody: item,
//         method: HttpMethod.PUT,
//         headers: {"Content-Type": "application/json"}
//         })

        

//     }),
//     catchError(e=>of(this.handleError(e, url, "Error with adding citation to list"))))


    
    

// }



private handleError(e: RestErrorResponse, item: any, message: String) {
  const props = item;//'item.barcode ? item.barcode : ['mms_id', 'holding_id', 'item_pid'].map(p=>item[p]).join(', ');
  if (item) {
  e.message = message + e.message + ` (${JSON.stringify(props)})`
  }
  return e;
  }
}
const isRestErrorResponse = (object: any): object is RestErrorResponse => 'error' in object;