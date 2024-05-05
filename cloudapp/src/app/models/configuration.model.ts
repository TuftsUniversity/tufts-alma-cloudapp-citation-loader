// work_order_type: "",
export class Configuration {
    mustConfig = {
      library: "",
      location: "",
      isChecked: false
    };
    isChecked = false;
    from: { locations?: string; } = {
      locations: ""
    };
  
    departmentArgs: { done: boolean } = { done: false };
    circArgs: { place_on_hold_shelf: boolean } = { place_on_hold_shelf: false };
  }