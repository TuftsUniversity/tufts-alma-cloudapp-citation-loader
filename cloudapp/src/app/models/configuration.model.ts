// work_order_type: "",
export class Configuration {
    mustConfig = {
      library: "",
      location: "",
   
    };
    from: { location?: string; } = {
      location: ""
    };
  
    departmentArgs: { done: boolean } = { done: false };
    circArgs: { place_on_hold_shelf: boolean } = { place_on_hold_shelf: false };
  }