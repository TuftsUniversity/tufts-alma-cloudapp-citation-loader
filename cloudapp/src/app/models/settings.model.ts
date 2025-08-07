export class Settings {

    library: string = "";
    location: string = "";
    isChecked: boolean = false;
    moveRequested: boolean = true;
    autoSkipUser: boolean = true;
    pub_status: string = "";
    visibility: string = "";
    //showValue: boolean = false;
    
  }

  // settings.model.ts

export interface Settings {
    // Already existing settings properties...
  
    coursePattern?: string;
    useLegacyMapping?: boolean;
    manualCourseEntry?: boolean;
    semesterMappings?: {
      [key: string]: string;  // e.g., { "Spring": "2", "Summer": "5" }
    };
  }


  