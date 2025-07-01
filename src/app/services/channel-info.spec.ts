import { TestBed } from '@angular/core/testing';

import { ChannelInfo } from './channel-info';

describe('ChannelInfo', () => {
    let service: ChannelInfo;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(ChannelInfo);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});