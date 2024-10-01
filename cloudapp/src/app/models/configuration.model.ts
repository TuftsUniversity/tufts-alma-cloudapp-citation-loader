// work_order_type: "",
export class Configuration {
    mustConfig = {
      library: "",
      location: "",
      isChecked: false,
      moveRequested: true,
      pub_status: "",
      visibility: ""
    };
    isChecked = false;
    moveRequested = true;
    from: { locations?: string; } = {
      locations: "",
     
    };
    
    
  
    departmentArgs: { done: boolean } = { done: false };
    circArgs: { place_on_hold_shelf: boolean } = { place_on_hold_shelf: false };
  }