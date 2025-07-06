import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LogoCache } from './logo-cache';

describe('LogoCache', () => {
  let component: LogoCache;
  let fixture: ComponentFixture<LogoCache>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LogoCache]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LogoCache);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
