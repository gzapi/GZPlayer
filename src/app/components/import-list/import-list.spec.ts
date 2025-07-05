import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportList } from './import-list';

describe('ImportList', () => {
  let component: ImportList;
  let fixture: ComponentFixture<ImportList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImportList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
