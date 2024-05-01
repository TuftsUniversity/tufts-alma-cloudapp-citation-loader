import { Library } from "./../models/library.model";
import { Location } from "./../models/location.model";
import { Configuration} from "./../models/configuration.model"
import { Component, OnInit } from "@angular/core";
import { NgForm } from "@angular/forms";
import {
  AlertService,
  CloudAppRestService,
  CloudAppSettingsService,
  RestErrorResponse,
} from "@exlibris/exl-cloudapp-angular-lib";
import { forkJoin, of } from "rxjs";
import { Router } from "@angular/router";
import { catchError, finalize, map } from "rxjs/operators";



@Component({
  selector: "app-settings",
  templateUrl: "./settings.component.html",
  styleUrls: ["./settings.component.scss"],
})
export class SettingsComponent implements OnInit {
  config: Configuration = new Configuration();
  libraries: Library[] = [];
  isChecked: boolean;
  locations: Location[] = [];
  citation_complete: boolean = false;

  loading: boolean = false;
  work_order_types :string[] =[];

  constructor(
    private settingsService: CloudAppSettingsService,
    private restService: CloudAppRestService,
    private alert: AlertService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loading = true;
    let rest = this.restService.call("/conf/libraries/");
    let config = this.settingsService.get();
  
    forkJoin({ rest, config }).subscribe({
      next: (value) => {
        this.libraries = value.rest.library as Library[];
        let emptyLib: Library = { link:"", code:"INST_LEVEL", path:"", name:"Institution Level", description:"",
                      resource_sharing:null, campus: null, proxy:"", default_location:null};
        this.libraries.unshift(emptyLib);
  
        if (value.config && Object.keys(value.config).length !== 0) {
          this.config = value.config;
          this.isChecked = this.config.isChecked; 
          this.onLibraryChange(value.config.mustConfig.library, true);
        }
      },
      error: (err) => {
        console.error(err.message);
        this.alert.error(err.message);
        this.loading = false;
      },
      complete: () => {
        this.loading = false;
      },
    });
  }

  onSubmit(form: NgForm) {
    //this.config.mustConfig.isChecked = this.isChecked; // Ensure isChecked is updated in the config
    this.settingsService.set(this.config).subscribe({
      next: () => {
        this.alert.success("Updated Successfully", { keepAfterRouteChange: true });
        this.router.navigate([""]);
      },
      error: (err: RestErrorResponse) => {
        console.error(err.message);
        this.alert.error(err.message);
      },
    });
  }
  onRestore() {
    this.config = new Configuration();
  }
  onLibraryChange(circ_code: string, init=false){
    this.loading = true;

    let code = circ_code == "INST_LEVEL" ? "" : circ_code;
    let rests = [this.getLocationData(code)];
 

    forkJoin(rests)
    .pipe(finalize(
      () => {
        this.loading = false;
        if (!init) {
          this.config.from.location = "";
        }else{
          this.onLocationChange(this.config.from.location);
        }
      }))
        .subscribe({
        next: (res ) => {
          if(res[0] != null){
            this.locations = res[0].location;
            this.locations.unshift({name : ' ',code:'',type:{value : ' '} });
          }
         
          
        },
        error: (err: RestErrorResponse) => {
          this.locations = [];
          
          console.error(err.message);
        }
      });
      
  }


  getLocationData(code) {
    return this.restService.call("/conf/libraries/" +code+ "/locations").pipe(
      catchError((error) => {
        // Handle errors from the department API
        this.locations = [];
        console.error(error.message);
        // Return a placeholder value or an empty observable to continue with the other API
        return of(null);
      })
    );
  }

  
  onLocationChange(location: string){
    
   // if(location != undefined && location != ''){
      const library = this.config.mustConfig.library == "INST_LEVEL" ?  "" : this.config.mustConfig.library;
      this.restService.call("/conf/libraries/" + library + "/locations" ).pipe(finalize(
        () => {
          this.loading = false;
        })).subscribe({
          next: (res) => {
            res.location.forEach(location => this.locations.push(location));
            
          },
          error: (err: RestErrorResponse) => {
            console.error(err.message);
          }
        });
    //}else if(department_code != undefined && department_code != ''){
      //this.onDepartmentChange(department_code);
    //}
  }

  onChangeCheckbox() {
    this.isChecked = !this.isChecked; // Toggle the checkbox state

    console.log(this.isChecked)
    // No need to call set here if it will be handled by the form submit
  }

//   onDepartmentChange(department_code: string){
//     this.departments.forEach(d => {
//       if(d.code == department_code){
//         this.work_order_types = [d.type.value];
//         this.onWorkOrderTypeChange(d.type.value);
//         return;
//       }
//     });
//   }

//   onWorkOrderTypeChange(work_order_type: string){
//     if(work_order_type ==' '){
//       this.statuses = [{column2 : ' ',column1 : ' ',column0:''}];
//       return;
//     }
//     const library = this.config.mustConfig.library == "INST_LEVEL" ?  "" : this.config.mustConfig.library;
//     this.loading = true;
//     this.restService.call("/conf/mapping-tables/WorkOrderTypeStatuses?scope="+library).pipe(finalize(
//       () => {
//         this.loading = false;
//       })).subscribe({
//         next: (res) => {
//           this.statuses = res.row.filter(row => row.column0 ==work_order_type );
//           this.statuses.unshift({column2 : ' ',column1 : ' ',column0:''});
//         },
//         error: (err: RestErrorResponse) => {
//           this.statuses = [];
//           console.error(err.message);
//         }
//       }); 
//   }

}