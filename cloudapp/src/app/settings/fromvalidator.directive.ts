import { Directive } from "@angular/core";
import { FormControl, NG_VALIDATORS, ValidatorFn } from "@angular/forms";

@Directive({
  selector: "[appFromvalidator]",
  providers: [{ provide: NG_VALIDATORS, useClass: FromvalidatorDirective, multi: true }],
})
export class FromvalidatorDirective {
  validator: ValidatorFn;

  constructor() {
    this.validator = this.fromValidator();
  }

  validate(c: FormControl) {
    return this.validator(c);
  }
  fromValidator(): ValidatorFn {
    return (control: FormControl) => {
      let isValid =
        control.value != null &&
        control.value.circ_desk != null &&
        control.value.department != null &&
        ((control.value.circ_desk !== "" && control.value.department === "") ||
          (control.value.circ_desk === "" && control.value.department !== ""));
      if (isValid) {
        return null;
      } else {
        return {
          fromvalidator: { valid: false },
        };
      }
    };
  }
}