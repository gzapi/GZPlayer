import { TestBed } from '@angular/core/testing';

import { M3uParser } from './m3u-parser';

describe('M3uParser', () => {
  let service: M3uParser;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(M3uParser);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
