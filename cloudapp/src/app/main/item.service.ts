import { Injectable } from '@angular/core';
import { CloudAppRestService, HttpMethod, RestErrorResponse  } from '@exlibris/exl-cloudapp-angular-lib';
import { of, combineLatest, Observable, Subscription, ObservableInput, Subject, ObservedValueOf,throwError, MonoTypeOperatorFunction, OperatorFunction, from, forkJoin   } from 'rxjs';

import { catchError, switchMap, share, map, mergeMap, concatMap} from 'rxjs/operators';
import { CloudAppEventsService, AlertService, CloudAppConfigService, EntityType, Request} from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateService } from '@ngx-translate/core';
import { HttpClientModule, HttpClient } from '@angular/common/http';


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
  previousCourseCode = "0"
  readingListId: any;
  selectedReadingList: any;
  singleList: boolean;
  citation: any;
  almaResult: any;
  original: any;
  item_record_update: any;
  almaReadingList: any;
  result: any;
  s = new Subject();
  items: any[];

  constructor(
    private restService: CloudAppRestService,
    private alert: AlertService,
    private translate: TranslateService,
    private http: HttpClient

  ) { }

  // operate<In, Out>({ destination, ...subscriberOverrides }: OperateConfig<In, Out>) {
  //   return new Subscriber(destination, subscriberOverrides);
  // }
//   private handleNonError<T, O extends ObservableInput<any>>(
//     selector: (err: any, caught: Observable<T>) => O
//   ): OperatorFunction<T, T | ObservedValueOf<O>> {
//     return (source: Observable<T>) => source.pipe(
//       mergeMap(response => {
//           // Perform the custom action for non-error responses
//           return callback(response);
//       }),
//       catchError(error => {
//           // Forward the error
//           return throwError(() => error);
//       })
//     )
// }

private handleOtherNonError<T, O extends ObservableInput<any>>(
  selector: (err: any, caught: Observable<T>) => O
): OperatorFunction<T, T | ObservedValueOf<O>> {
  return (source: Observable<T>) =>
  new Observable<T | ObservedValueOf<O>>((subscriber) => {
    const subscription = new Subscription();

    subscription.add(source.subscribe({
      next(value) {
        subscriber.next(value);
      },
      error(err) {
        let handledResult: Observable<ObservedValueOf<O>>;
        try {
          handledResult = from(selector(err, catchError(selector)(source)));
          subscription.add(handledResult.subscribe(subscriber));
        } catch (e) {
          subscriber.error(e);
        }
      },
      complete() {
        subscriber.complete();
      }
    }));

    return () => subscription.unsubscribe();
  });

}

private handleOtherError<T, O extends ObservableInput<any>>(
  selector: (err: any, caught: Observable<T>) => O
): OperatorFunction<T, T | ObservedValueOf<O>> {
  return (source: Observable<T>) =>
  new Observable<T | ObservedValueOf<O>>((subscriber) => {
    const subscription = new Subscription();

    subscription.add(source.subscribe({
      next(value) {
        subscriber.next(value);
      },
      error(err) {
        let handledResult: Observable<ObservedValueOf<O>>;
        try {
          handledResult = from(selector(err, catchError(selector)(source)));
          subscription.add(handledResult.subscribe(subscriber));
        } catch (e) {
          subscriber.error(e);
        }
      },
      complete() {
        subscriber.complete();
      }
    }));

    return () => subscription.unsubscribe();
  });

}
  processUser(item: any, previousEntry: any, previousCode: any, processed: number) {
    
    let course_code:string;
    let mms_id: string;
    if ('course_code' in item){

      course_code = item.course_code.replace(/[\{\}"']/g, "");
    }

    else{

      course_code = item['Course Code'].replace(/[\{\}"']/g, "");
    }

    
    
    
    if ('mms_id' in item){

      mms_id = item.mms_id
    }

    else{
      mms_id = item['MMS ID'].replace(/[\{\}"']/g, "");
    }

    let course_section: string;
    let course_code_and_section: string;
    let course_code_and_section_url: string;
    if ('course_section' in item && item.course_section != ''){
      course_section = item.course_section;
      course_code_and_section = course_code + "-" + course_section;
      course_code_and_section_url = `/courses?q=code~${course_code}%20AND%20section~${course_section}`;
    }

    else if ('Course Section' in item){
      course_section = item['Course Section'];
      course_code_and_section = course_code + "-" + course_section;
      course_code_and_section_url = `/courses?q=code~${course_code}%20AND%20section~${course_section}`;

    }

    else{

      course_code_and_section_url = `/courses?q=code~${course_code}`;
    }


    //let previous_course_code: string;
    //let previous_course_section: string;
    let previous_course_code_and_section: string;

    if (previousEntry.length > 1){
    //if ('course' in previousEntry[previousEntry.length - 1]){
     // console.log(`previous course code: ${JSON.stringify(previousEntry[previousEntry.length - 1].course[0]['code'])}`)
      previous_course_code_and_section = previousCode[previousCode.length - 1]
      //previous_course_section = previousEntry[previousEntry.length - 1].course[0]['section']
      //previous_course_code_and_section = previous_course_code + "-" + previous_course_section;
    //}

    //else{}
  }

  
    if(processed == 0 || processed > 0 && course_code_and_section != previous_course_code_and_section){

      
      
      let url= course_code_and_section_url;
      return this.restService.call(url).pipe(
      
        
        catchError(e=>{
            console.log(`Error in course lookup for ${course_code_and_section} `)
            throw(e);
          }
        ),
        // map(item => {
        //   if (item.course_code == this.previousCourseCode){
        //     throw 0
        //   }
        //   return item;
        // }
        //   ),
        switchMap(original=>{
  
  
  
  
          
  
          try {
  
          if (original==null) {
            return this.restService.call({
              url: '/users',
              method: HttpMethod.POST,
              requestBody: item
            });
          } else {
          
  
            url= original['link'] ? original['link'].substring(original['link'].indexOf("/almaws/v1/")+10 ): url;
            return this.restService.call({
              url: url,
              method: HttpMethod.GET,
              // requestBody: original
            })
          }
          }

          catch {
            console.log(`Error in course lookup for ${course_code_and_section} `)
            catchError(e=>of(this.handleError(e, item, `Error with course lookup for course source of error ${item.course_code}`)))

          }
        }))



      }
        else{
      console.log("Successfully skipped\n\n\n\n")
      const source$ = of(previousEntry[previousEntry.length -1])
    return source$.pipe(
      this.handleOtherNonError(response => {
            console.log("Previous entry in skip")
            console.log(previousEntry[previousEntry.length -1])
             // For non-redirects, just pass the original response through
             return of(response);
         
     })
 )
    }
    
    }



private isRestErrorResponse = (object: any): object is RestErrorResponse => 'error' in object;

private handleError(e: RestErrorResponse, item: any, message: String) {
  const props = item;//'item.barcode ? item.barcode : ['mms_id', 'holding_id', 'item_pid'].map(p=>item[p]).join(', ');
  if (item) {
  e.message = message + e.message + ` (${JSON.stringify(props)})`
  }
  return e;
  }

  private handleErrorTooManyReadingLists(e: RestErrorResponse, item: any) {
    const props = item;//'item.barcode ? item.barcode : ['mms_id', 'holding_id', 'item_pid'].map(p=>item[p]).join(', ');
    if (item) {
    e.message = e.message + ` Too many reading lists.   Assignment Ambiguous (${JSON.stringify(props)})`
    }
    return e;
    }

    sendDummyResponse(item){



      return of(item)
    }
isRepeat(listItem: String, lastItem: String, processed){

  if(listItem == lastItem || processed == 0){
    return of(true);
  }
  else{
    return of(false)
  }


}
readingListLookup(course: any, course_code: any, course_id: any, previousReadingListCourseCode: any, previousRLEntry: any, processed: number, valid: boolean) {
 
    if (valid){
    


     let url = `/courses/${course_id}/reading-lists`
     

     
     
      //console.log(url);

      

      console.log(`Course code: ${course_code}`);
      console.log(`previous reading list course code: ${previousReadingListCourseCode[previousReadingListCourseCode.length -1]}`)

  if(processed == 0 || processed > 0 && course_code != previousReadingListCourseCode[previousReadingListCourseCode.length -1]){


    return this.restService.call(url).pipe(

//   catchError(e=>{
//     console.log(`Error in reading list lookup for ${course[1].course[0]['code']} `)
//     return(e);
//   }
// ),
  


  
      //     concatMap(reading_lists =>  {
      //     // try{
         
      //       console.log(JSON.stringify(reading_lists));
      //     return forkJoin([reading_lists, course]).pipe(catchError(e => {throw (e)}))    
      //     // }
      // //     catch{
      // //       console.log(`Error in course lookup for ${courses[0]['code']} `)
      // //       const source$ = of([{ status: 200, data: courses[0]['code']}, 'error', { status: 200, data: `Course lookup for course ${item.course_code} failed.` }]);
      // //       return source$.pipe(
      // //      this.handleOtherError(response => {
  
      // //             // For non-redirects, just pass the original response through
      // //             return of(response);
              
      // //     })
      // // )
      // //     }
      //   }
      //     )
        
        concatMap( reading_lists => {
         // console.log(JSON.stringify(reading_lists));
       
          // try{
            if("error" in reading_lists){
              catchError(e => {throw(e)})
            //   console.log(`Error in reading list lookup for ${reading_lists[1]} `)
            //   const source$ = of([{ status: 200, data: item.course_code}, 'error', { status: 200, data: `Lookup for course ${item.course_code} failed` }, of(item.mms_id), of(item.course_code)]);
            //   return source$.pipe(
            //  this.handleOtherError(response => {
    
            //         // For non-redirects, just pass the original response through
            //         return of(response);
                
            // })
            //   )
  
            }
            
            
          else if ('reading_list' in reading_lists){
          if(reading_lists['reading_list'].length == 1){
            console.log(`1 reading list for course ${course_code} `)
            
            return of(reading_lists)
          }

          else if (reading_lists['reading_list'].length > 1) {
            console.log(`More than one reading list for ${course_code} `)
           
            const source$ = of([{ status: 200, data: reading_lists}, 'more_than_one_reading_list', { status: 200, data: `More than one reading list for course ${course.course[0]['code']}.  Assignment ambiguous` }]);
            return source$.pipe(
           this.handleOtherError(response => {
  
                  // For non-redirects, just pass the original response through
                  return of(response);
              
          })
      )
          }

          else {
            console.log(`else: reading lists: ${JSON.stringify(reading_lists)}`);
            return of(reading_lists);
          }
        }
          else if ('link' in reading_lists){
            console.log(`No existing reading lists for ${course_code}  create one`)
            return this.createList(reading_lists, course)  
          }
        // }

        //   catch {
        //     console.log(`error in reading list process for course ${course[1].course[0]['code']}`);
        //     catchError(e=>of(this.handleError(e, reading_lists,`Error in chaing of course and reading list lookup for course: ${course[1].course[0]['code']}`)))
        //   }

      }
      
          
          )//,catchError(e=>of(this.handleError(e, course, `Error in chain of course and reading list lookup for course: ${course[1].course[0]['code']} `)))
        
        
      
)


    }

    else{
      console.log("Successfully skipped\n\n\n\n")
      const source$ = of(previousRLEntry[previousRLEntry.length -1])
      console.log(previousRLEntry[previousRLEntry.length -1])
    return source$.pipe(
      this.handleOtherNonError(response => {
            console.log("Previous entry in skip")
            console.log(previousRLEntry[previousRLEntry.length -1])
             // For non-redirects, just pass the original response through
             return of(response);
         
     })
 )
    }

  }


  else{
    
    console.log(`Course error for ${course_code}.   reading list null`)
           
    const source$ = of([{ status: 200, data: course_code}, 'invalid_course_reading_list_null', { status: 200, data: `invalid_course_reading_list_null for ${course_code}` }]);
    return source$.pipe(
   this.handleOtherError(response => {

          // For non-redirects, just pass the original response through
          return of(response);
      
  })
)

  }
}
   




//   catchError(e=>of(this.handleError(e, id, `Error in reading list lookup for course id: ${id}`))

  
//   )
// )

//   }




getReadingList(id: any){
  let url= `/courses/${id}/reading-lists`;


  let readingListUrl = `courses/${this.almaCourseId}/reading-lists`
  return this.restService.call(readingListUrl).pipe(
    catchError(e=>{
        throw(e);
      }
    )
  )

}

  almaCourseLookup(course_code: any) {
    // this.loading = true;
    // let request: Request = {
    //   url: `/courses?code~${course_code}`,
    //   method: HttpMethod.GET
    

    
    return this.restService.call(`/courses?code~${course_code}`)
    .subscribe(res =>{
      return this.almaCourseId.map(res => res.course[0]['id']);
    }
    )
    
  
    }



  createList(reading_list: any, course: any) {


    console.log(JSON.stringify(reading_list))
          
  
    // try {
    

      //console.log(JSON.stringify(course));

    let readingListObj = `{
      "code": "${course.course[0]['code']}",
       "name": "${course.course[0]['name']}",
      "due_back_date": "${course.course[0]['end_date']}",
      "status": {
        "value": "BeingPrepared"
      },
      "publishingStatus": {
        "value": "PUBLISHED"
      },
      "visibility": {
        "value":"RESTRICTED"
      }

    }`;
    return this.restService.call( {
      url: `/courses/${course.course[0]['id']}/reading-lists`,
      method: HttpMethod.POST,
      headers: {"Content-Type": "application/json"},
      requestBody: readingListObj
    }).pipe(
    catchError(e=>{
        throw(e);
      }
    ),
     concatMap(original=>{
       if (original==null) {
         return this.restService.call( {
      url: `/courses/${course.course[0]['id']}/reading-lists`,
      method: HttpMethod.POST,
      headers: {"Content-Type": "application/json"},
      requestBody: readingListObj
    });
       } else{

        if('id' in original){

          return(of(original));

        }
        else{

        
        console.log("error in reading list creation")
        const source$ = of([{ status: 200, data: course}, 'create_citation_false', { status: 200, data: `reading list creation failed for ${course}` }]);
        return source$.pipe(
          this.handleOtherError(response => {
  
                  // For non-redirects, just pass the original response through
                  return of(response);
              
          })
      )
        }
      }
}),


    
    catchError(e=>of(this.handleError(e, course.course[0]['code'], "Error with create list")))
    
  )
    
    

    

}

    addToList(almaReadingListId: string, almaCourseId: string, mms_id, citation_type: string, reading_list_section: string, complete: boolean) {

      let type: string = "BK";
      let section: string = "Resources";
      if (citation_type){

        if (citation_type != ""){
          type = citation_type;
        }
      }


      if (reading_list_section){

        if (reading_list_section != ""){

          section = reading_list_section;
        }
      }


      console.log(complete)
      let complete_setting: string;
      if (complete && complete == true){

        complete_setting = "Complete";
      }

      else {complete_setting = "BeingPrepared"}

        
      
      this.citation = `{
        "status": {
          "value": "${complete_setting}"
        },
        "copyrights_status": {
          "value": "NOTREQUIRED"
        },
         "type": {
           "value": "BK"
         },

         "secondary_type" : {

          "value": "${type}"
         },
        "metadata": {
          "mms_id": "${mms_id}"
        },
        "section_info":{
          "name": "${section}", "visibility": "true"
        }
      }`

  


      //Add to reading list in Alma
      return this.restService.call(`/bibs/${mms_id}`).pipe(catchError(e=>{
        throw(e);
      }),
      switchMap(bib => {
   
        if ('mms_id' in bib){
          return this.restService.call( {
            url: `/courses/${almaCourseId}/reading-lists/${almaReadingListId}/citations`,
            requestBody: this.citation,
            method: HttpMethod.POST,
            headers: {"Content-Type": "application/json"}
            })

        }

        else{
          console.log("bad mms id")
          const source$ = of([{ status: 200, data: mms_id}, 'create_citation_false', { status: 200, data: `Lookup failed for MMS ID ${mms_id}` }]);
          return source$.pipe(
            this.handleOtherError(response => {
    
                    // For non-redirects, just pass the original response through
                    return of(response);
                
            })
        )
        }

        
       

      }),
      catchError(e=>of(this.handleError(e, mms_id, "Error with adding citation to list")))

      )


      
        
    }

   

getCitations(almaReadingListId, almaCourseId) {


  //Add to reading list in Alma
  return this.restService.call(`/courses/${almaCourseId}/reading-lists/${almaReadingListId}/citations`).pipe(catchError(e=>{
    throw(e);
  }),
  switchMap(citations => {
  
      return this.restService.call( {
        url: `/courses/${almaCourseId}/reading-lists/${almaReadingListId}/citations`,
        method: HttpMethod.GET,
        headers: {"Content-Type": "application/json"}
        })



    
   

  }),
  catchError(e=>of(this.handleError(e, almaReadingListId, "error with getting citations for reading list")))

  )


  
    
}





  getBib (mmsId: string) {
    return this.restService.call(`/bibs/${mmsId}`)
      .pipe(catchError(e=> {throw (e)})
      ,
      switchMap(bib => {

        if ('bib' in bib){


        }

        return this.restService.call(`/bibs/${mmsId}`) 

      })
      ),
      catchError(e=>of(this.handleError(e, mmsId, "Error with MMS ID look up for " + mmsId)))
      

     

  }

  updateItem(barcode: string, reserves_library: string, reserves_location: string){

   // console.log("got into function");
   
    return this.restService.call(`/items?item_barcode=${barcode}`)
    
    .pipe(catchError(e=>{
      throw(e);
    }),
    switchMap(item => {
      // if ('pid' in item['item_data']){
      let url  = item['link'].replace(/.+?(\/bibs.+)/g, "$1");
      //console.log(url);
      // console.log(JSON.stringify(item));
      item['holding_data']['in_temp_location'] = "true";
      item['holding_data']['temp_library']['value'] = reserves_library;
      item['holding_data']['temp_location']['value'] = reserves_location;

      item = JSON.stringify(item)
      // item = JSON.parse(item);
      
      console.log(JSON.stringify(item));
      //url= item['link'] ? item['link'].substring(item['link'].indexOf("/almaws/v1/")+10 ): url
      
      // if ('pid' in item['item_data']){
        return this.restService.call( {
          url: url,
          requestBody: item,
          method: HttpMethod.PUT,
          headers: {"Content-Type": "application/json"}
          })

      // }

      // else{
      //   console.log("error with item lookup")
      //   const source$ = of([{ status: 200, data: barcode}, 'create_citation_false', { status: 200, data: `Lookup failed for MMS ID ${barcode}` }]);
      //   return source$.pipe(
      //     this.handleOtherError(response => {
  
      //             // For non-redirects, just pass the original response through
      //             return of(response);
              
      //     })
      // )
      // }

      
     

    }),
    catchError(e=>of(this.handleError(e, barcode, "Error with adding citation to list")))

    )



  }

  completeReadingLists(url: any){

    return this.restService.call(url)
      .pipe(catchError(e=> {throw (e)})
      
      ,
      switchMap(item => {

        item["status"]["value"] = "Complete";
        item["status"]["desc"] = "Complete";
        console.log(JSON.stringify(item));
        return this.restService.call( {
          url: url,
          requestBody: item,
          method: HttpMethod.PUT,
          headers: {"Content-Type": "application/json"}
          })

          

      }),
      catchError(e=>of(this.handleError(e, url, "Error with adding citation to list"))))


  }

 

  


  
 }