import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LookupToolComponent } from './lookup-tool.component';

describe('LookupToolComponent', () => {
  let component: LookupToolComponent;
  let fixture: ComponentFixture<LookupToolComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LookupToolComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LookupToolComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
