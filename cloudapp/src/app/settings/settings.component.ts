import { Library } from './../models/library.model';
import { Location } from './../models/location.model';
import { Configuration } from './../models/configuration.model';
import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import {
  AlertService,
  CloudAppRestService,
  CloudAppSettingsService,
  RestErrorResponse,
} from '@exlibris/exl-cloudapp-angular-lib';
import { forkJoin, of } from 'rxjs';
import { Router } from '@angular/router';
import { catchError, finalize } from 'rxjs/operators';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit {
  config: Configuration = new Configuration();
  libraries: Library[] = [];
  locations: Location[] = [];

  isChecked = false;
  moveRequested = true;
  citation_complete = false;
  pub_status = '';
  visibility = '';

  loading = false;
  work_order_types: string[] = [];

  constructor(
    private settingsService: CloudAppSettingsService,
    private restService: CloudAppRestService,
    private alert: AlertService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loading = true;

    const rest = this.restService.call('/conf/libraries/');
    const config = this.settingsService.get();

    forkJoin({ rest, config }).subscribe({
      next: (value) => {
        this.config = Object.assign(new Configuration(), value.config || {});

        this.libraries = (value.rest.library || []) as Library[];

        const emptyLib: Library = {
          link: '',
          code: 'INST_LEVEL',
          path: '',
          name: 'Institution Level',
          description: '',
          resource_sharing: null,
          campus: null,
          proxy: '',
          default_location: null
        };

        this.libraries.unshift(emptyLib);

        this.isChecked = this.config.isChecked;
        this.moveRequested = this.config.moveRequested;
        this.pub_status = this.config.mustConfig.pub_status;
        this.visibility = this.config.mustConfig.visibility;

        if (this.config.mustConfig.library) {
          this.onLibraryChange(this.config.mustConfig.library, true);
        }
      },
      error: (err: Error) => {
        console.error(err.message);
        this.alert.error(err.message);
        this.loading = false;
      },
      complete: () => {
        this.loading = false;
      },
    });
  }

  onSubmit(_form: NgForm): void {
    if (this.config.moveRequested) {
      if (!this.config.mustConfig?.library) {
        this.alert.error('Library is required when moving physical items.');
        return;
      }

      if (!this.config.from?.locations) {
        this.alert.error('Location is required when moving physical items.');
        return;
      }
    }

    if (!this.config.mustConfig?.visibility) {
      this.alert.error('Reading list visibility is required.');
      return;
    }

    if (!this.config.mustConfig?.pub_status) {
      this.alert.error('Publication status is required.');
      return;
    }

    this.settingsService.set(this.config).subscribe({
      next: () => {
        this.alert.success('Updated Successfully', { keepAfterRouteChange: true });
        this.router.navigate(['']);
      },
      error: (err: RestErrorResponse) => {
        console.error(err.message);
        this.alert.error(err.message);
      },
    });
  }

  onRestore(): void {
    this.config = new Configuration();
    this.isChecked = this.config.isChecked;
    this.moveRequested = this.config.moveRequested;
    this.pub_status = this.config.mustConfig.pub_status;
    this.visibility = this.config.mustConfig.visibility;
    this.locations = [];
  }

  onLibraryChange(circCode: string, init = false): void {
    this.loading = true;

    const code = circCode === 'INST_LEVEL' ? '' : circCode;
    const rests = [this.getLocationData(code)];

    forkJoin(rests)
      .pipe(
        finalize(() => {
          this.loading = false;
          if (!init) {
            this.config.from.locations = '';
          } else if (this.config.from.locations) {
            this.onLocationChange(this.config.from.locations);
          }
        })
      )
      .subscribe({
        next: (res) => {
          if (res[0] != null) {
            this.locations = res[0].location || [];
            this.locations.unshift({ name: ' ', code: '', type: { value: ' ' } });
          }
        },
        error: (err: RestErrorResponse) => {
          this.locations = [];
          console.error(err.message);
        }
      });
  }

  getLocationData(code: string) {
    return this.restService.call('/conf/libraries/' + code + '/locations').pipe(
      catchError((error) => {
        this.locations = [];
        console.error(error.message);
        return of(null);
      })
    );
  }

  onLocationChange(_location: string): void {
    const library = this.config.mustConfig.library === 'INST_LEVEL' ? '' : this.config.mustConfig.library;

    this.loading = true;
    this.restService.call('/conf/libraries/' + library + '/locations')
      .pipe(
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe({
        next: (res: any) => {
          this.locations = (res.location || []).slice();
          this.locations.unshift({ name: ' ', code: '', type: { value: ' ' } });
        },
        error: (err: RestErrorResponse) => {
          console.error(err.message);
        }
      });
  }

  onPubStatusChange(pubStatus: string): void {
    this.pub_status = pubStatus;
  }
}