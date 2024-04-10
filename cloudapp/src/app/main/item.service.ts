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
  processUser(item: any, previousEntry: any, processed: number) {
    
    let course_code = item.course_code.replace(/[\{\}"']/g, "");
    let course_id: string;
    let mms_id = item['MMS ID'].replace(/[\{\}"']/g, "");
    let barcode: string = item.Barcode.replace(/[\{\}"']/g, "");

    if(processed == 0 || processed > 0 && course_code != previousEntry[previousEntry.length - 1][4]){
      // console.log(`Processed: ${processed}`);
      // console.log(`Item.course_code: ${item.course_code}`)
      // console.log(`type of item.course_code`)
      // console.log(`typeof previousEntry: ${typeof item.course_code}`);
      // console.log(`previous entry: ${previousEntry}`)
      // console.log()
      // try{
      //   console.log(`typeof previousEntry: ${typeof previousEntry}`);
      //   console.log(`typeof previousEntry: ${typeof previousEntry[previousEntry.length - 1][4]}`);
      //   console.log(`previous entry course code: ${JSON.stringify(previousEntry[previousEntry.length - 1][4])}`)
      // }
      // catch{

      //   console.log("first")
      // }
      
      this.previousCourseCode = course_code
      let url= `/courses?q=code~${course_code}`;
      return this.restService.call(url).pipe(
      
        
        catchError(e=>{
            console.log(`Error in course lookup for ${course_code} `)
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
            console.log(`Error in course lookup for ${course_code} `)
            catchError(e=>of(this.handleError(e, item, `Error with course lookup for course source of error ${course_code}`)))

          }
        }),
        concatMap(courses =>  {
          try{
         
          return forkJoin([this.readingListLookup(courses), of(course_code), of(courses), of(mms_id)])    
          }
          catch{
            console.log(`Error in course lookup for ${item.course_code} `)
            const source$ = of([{ status: 200, data: course_code, data2: mms_id}, 'error', { status: 200, data: `Course lookup for course ${course_code} failed.` }]);
            return source$.pipe(
           this.handleOtherError(response => {
  
                  // For non-redirects, just pass the original response through
                  return of(response);
              
          })
      )
          }
        }
          )
        
        , concatMap( reading_lists => {
       
          try{
            if(reading_lists[1] == "error"){
              console.log(`Error in reading list lookup for ${course_code} `)
              const source$ = of([{ status: 200, data: course_code}, 'error', { status: 200, data: `Lookup for course ${course_code} failed` }, of(mms_id), of(course_code)]);
              return source$.pipe(
             this.handleOtherError(response => {
    
                    // For non-redirects, just pass the original response through
                    return of(response);
                
            })
              )
  
            }
            
            
          else if ('reading_list' in reading_lists[0]){
          if(reading_lists[0].reading_list.length == 1){
            console.log(`1 reading list for course ${course_code} `)
            
            return forkJoin([of(reading_lists[0]), of(reading_lists[1]), of(reading_lists[2]), of(mms_id), of(course_code)])
          }

          else if (reading_lists[0].reading_list.length > 1) {
            console.log(`More than one reading list for ${course_code} `)
            //catchError(e=>of(this.handleError(e, item, `More than 1 reading list for course ${item.course_code}.  Reading list assignment ambiguous`)))
            //catchError(e=>of("More than 1 reading list assignment ambiguous" + e))//this.handleError(e, item, `More than 1 reading list for course ${item.course_code}.  Reading list assignment ambiguous`)))
            //return combineLatest([of(reading_lists[0]), of(reading_lists[1]), of(reading_lists[2])]) 
            const source$ = of([{ status: 200, data: item.course_code, data2:mms_id}, 'error', { status: 200, data: `More than one reading list for course ${item.course_code}.  Assignment ambiguous` }, of(item.mms_id), of(item.course_code)]);
            return source$.pipe(
           this.handleOtherError(response => {
  
                  // For non-redirects, just pass the original response through
                  return of(response);
              
          })
      )
          }

          else {
            console.log(`else: reading lists: ${JSON.stringify(reading_lists)}`);
            return forkJoin([of(reading_lists[0]), of(reading_lists[1]), of(reading_lists[2]), of(mms_id), of(course_code)])
          }
        }
          else if ('link' in reading_lists[0]){
            console.log(`No existing reading lists for ${course_code}  create one`)
            return forkJoin([this.createList(reading_lists[0], reading_lists[2]), of(reading_lists[1]), of(reading_lists[2]), of(mms_id), of(course_code)])  
          }
        }

          catch {
            console.log(`error in reading list process for course ${course_code}`);
            catchError(e=>of(this.handleError(e, item,`Error in chaing of course and reading list lookup for course1: ${course_code}`)))
          }

      }
      
          
          ),catchError(e=>of(this.handleError(e, item, `Error in chain of course and reading list lookup for course2: ${course_code} `)))
        
        
      )
      
        

    }

    else{
      console.log("Successfully skipped\n\n\n\n")
      const source$ = of(previousEntry[previousEntry.length -1])
    return source$.pipe(
      this.handleOtherNonError(response => {

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
readingListLookup(course: any) {
 
    let url = `/courses/${undefined}/reading-lists`;
  let id = course;


     url = `/courses/${course.course[0]['id']}/reading-lists`
     id = course.course[0]['id'];


  


return this.restService.call(url).pipe(
  catchError(e=>{
      throw(e);
    }
  ),
  mergeMap(original=>{
    if (original==null) {
      return this.restService.call({
        url: '/users',
        method: HttpMethod.GET,
        requestBody: course
      });
    } else {

  
      return this.restService.call({
        url: url,
        method: HttpMethod.GET,
      
      })
    }
  }),
  catchError(e=>of(this.handleError(e, id, `Error in reading list lookup for course id: ${id}`))

  
  )
)

  }




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
    

    
    this.restService.call(`/courses?code~${course_code}`)
    .subscribe(res =>{
      return this.almaCourseId.map(res => res.course[0]['id']);
    }
    )
    
  
    }



  createList(reading_list: any, course: any) {


          
  
    // try {
    


    let readingListObj = `{
      "code": "${course.course[0]['code']}",
       "name": "${course.course[0]['code']}-${course.course[0]['section']}",
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
        console.log("error in reading list creation")
        const source$ = of([{ status: 200, data: course}, 'create_citation_false', { status: 200, data: `reading list creation failed for ${course}` }]);
        return source$.pipe(
          this.handleOtherError(response => {
  
                  // For non-redirects, just pass the original response through
                  return of(response);
              
          })
      )
      }
}),


    
    catchError(e=>of(this.handleError(e, course.course[0]['code'], "Error with create list")))
    
  )
    
    

    

}

    addToList(almaReadingListId, almaCourseId, mms_id, citation_type) {

      this.citation = `{
        "status": {
          "value": "Complete"
        },
        "copyrights_status": {
          "value": "NOTREQUIRED"
        },
        "type": {
          "value": "BK"
        },
        "metadata": {
          "mms_id": "${mms_id}"
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

    console.log("got into function");
   
    // if (!reserves_library ||!reserves_location){

    //   console.log("no location provided")
    //   const source$ = of([{ status: 200, data: reserves_library + reserves_location}, 'no_library_or_location', { status: 200, data: `No library or location provided` }]);
    //   return source$.pipe(
    //     this.handleOtherError(response => {

    //             // For non-redirects, just pass the original response through
    //             return of(response);
            
    //     })
    // )
    

    // }

    // else {
    return this.restService.call(`/items?item_barcode=${barcode}`)
    
    .pipe(catchError(e=>{
      throw(e);
    }),
    switchMap(item => {
      // if ('pid' in item['item_data']){
      let url  = item['link'].replace(/.+?(\/bibs.+)/g, "$1");
      console.log(url);
      // console.log(JSON.stringify(item));
      item['holding_data']['in_temp_location'] = "true";
      item['holding_data']['temp_library']['value'] = reserves_library;
      item['holding_data']['temp_location']['value'] = reserves_location;

      item = JSON.stringify(item)
      // item = JSON.parse(item);
      
      console.log(item);
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



  //}

}

 

  


  
 }