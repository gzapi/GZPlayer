import { TestBed } from '@angular/core/testing';

import { Functions } from './functions';

describe('Functions', () => {
  let service: Functions;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Functions);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
