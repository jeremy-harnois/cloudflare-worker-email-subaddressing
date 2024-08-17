import { describe, expect, it, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import worker, { DEFAULTS } from 'worker';

describe('Email Subaddressing', () => {
    const context = {}

    const message = {
        from: 'random@internet.com',
        forward: (to, headers) => JSON.stringify({ to, headers }),
        setReject: (reason) => reason,
        // ...
        to: undefined,
        // ---
        headers: {},
        raw: null,
        rawSize: null,        
    }
    const forward = vi.spyOn(message, 'forward');
    const reject = vi.spyOn(message, 'setReject');
    
    beforeEach(async () => {
        message.to = null;
    });
    
    afterEach(async () => {
        vi.clearAllMocks();
    });
    
    describe('Defaults', () => {
        const environment = {};

        it.each([
            ['user1@domain.com', DEFAULTS.FAILURE],
            ['user1+subA@domain.com', DEFAULTS.FAILURE],
            ['user2@domain.com', DEFAULTS.FAILURE],
            ['user2+subA@domain.com.com', DEFAULTS.FAILURE],
            ['user2+subB@domain.com', DEFAULTS.FAILURE]
        ])('%s should reject with "%s"', async (to, reason) => {
            message.to = to;
            await worker.email(message, environment, context);
            expect(forward).not.toHaveBeenCalled();
            expect(reject).toHaveBeenCalledWith(reason);
        });
    });
    
    describe('Environement variables', () => {

        describe('Single user, any subaddress, single destination, reject', () => {
            const environment = {
                USERS: 'user1',
                DESTINATION: 'user@email.com'
            };

            it.each([
                ['user1@domain.com', environment.DESTINATION],
                ['user1+subA@domain.com', environment.DESTINATION]
            ])('%s should forward to %s', async (to, dest) => {
                message.to = to;
                await worker.email(message, environment, context);
                expect(reject).not.toHaveBeenCalled();
                expect(forward).toHaveBeenCalledWith(dest, new Headers({ [DEFAULTS.HEADER]: 'PASS' }));
            });

            it.each([
                ['user2@domain.com', DEFAULTS.FAILURE],
                ['user2+subA@domain.com', DEFAULTS.FAILURE]
            ])('%s should reject with "%s"', async (to, reason) => {
                message.to = to;
                await worker.email(message, environment, context);
                expect(forward).not.toHaveBeenCalled();
                expect(reject).toHaveBeenCalledWith(reason);
            });
        });

        describe('Multiple users, any subaddress, domain destination, fail-forward', () => {
            const environment = {
                USERS: 'user1,user2',
                DESTINATION: '@email.com',
                FAILURE: '+spam@email.com'
            };

            it.each([
                ['user1@domain.com', `user1${environment.DESTINATION}`],
                ['user1+subA@domain.com', `user1${environment.DESTINATION}`],
                ['user2@domain.com', `user2${environment.DESTINATION}`],
                ['user2+subA@domain.com', `user2${environment.DESTINATION}`]
            ])('%s should forward to %s', async (to, dest) => {
                message.to = to;
                await worker.email(message, environment, context);
                expect(reject).not.toHaveBeenCalled();
                expect(forward).toHaveBeenCalledWith(dest, new Headers({ [DEFAULTS.HEADER]: 'PASS' }));
            });

            it.each([
                ['user3@domain.com', `user3${environment.FAILURE}`],
                ['user3+subA@domain.com', `user3${environment.FAILURE}`]
            ])('%s should forward to "%s"', async (to, dest) => {
                message.to = to;
                await worker.email(message, environment, context);
                expect(reject).not.toHaveBeenCalled();
                expect(forward).toHaveBeenCalledWith(dest, new Headers({ [DEFAULTS.HEADER]: 'FAIL' }));
            });
        });

        describe('Any user, specific subaddresses, single destination, custom reject', () => {
            const environment = {
                USERS: '*',
                SUBADDRESSES: 'subA,subB',
                DESTINATION: 'user@email.com',
                FAILURE: 'No such recipient'
            };

            it.each([
                ['user1@domain.com', environment.DESTINATION],
                ['user1+subA@domain.com', environment.DESTINATION],
                ['user1+subB@domain.com', environment.DESTINATION],
                ['userN@domain.com', environment.DESTINATION],
                ['userN+subA@domain.com', environment.DESTINATION],
                ['userN+subB@domain.com', environment.DESTINATION]
            ])('%s should forward to %s', async (to, dest) => {
                message.to = to;
                await worker.email(message, environment, context);
                expect(reject).not.toHaveBeenCalled();
                expect(forward).toHaveBeenCalledWith(dest, new Headers({ [DEFAULTS.HEADER]: 'PASS' }));
            });

            it.each([
                ['userN+subC@domain.com', environment.FAILURE]            
            ])('%s should reject with "%s"', async (to, reason) => {
                message.to = to;
                await worker.email(message, environment, context);
                expect(forward).not.toHaveBeenCalled();
                expect(reject).toHaveBeenCalledWith(reason);
            });
        });

        describe('..., custom subaddressing separator character, custom forward header', () => {
            const environment = {
                USERS: 'user1',
                DESTINATION: 'user@email.com',
                SEPARATOR: '--',
                FAILURE: 'user+spam@email.com',
                HEADER: 'X-CUSTOM'
            };

            it.each([
                ['user1@domain.com', environment.DESTINATION],
                ['user1--subA@domain.com', environment.DESTINATION]
            ])('%s should forward to %s', async (to, dest) => {
                message.to = to;
                await worker.email(message, environment, context);
                expect(reject).not.toHaveBeenCalled();
                expect(forward).toHaveBeenCalledWith(dest, new Headers({ [environment.HEADER]: 'PASS' }));
            });

            it.each([
                ['user1+subA@domain.com', environment.FAILURE],
                ['user2@domain.com', environment.FAILURE],
                ['user2--subA@domain.com', environment.FAILURE]
            ])('%s should forward to "%s"', async (to, dest) => {
                message.to = to;
                await worker.email(message, environment, context);
                expect(reject).not.toHaveBeenCalled();
                expect(forward).toHaveBeenCalledWith(dest, new Headers({ [environment.HEADER]: 'FAIL' }));
            });
        });
    });
    
    describe('KV globals', () => {

        describe('Single user, any subaddress, single destination, reject', () => {
            const MAP = new Map();
            MAP.set('@USERS', 'user1');
            MAP.set('@DESTINATION', 'user@email.com');

            it.each([
                ['user1@domain.com', MAP.get('@DESTINATION')],
                ['user1+subA@domain.com',MAP.get('@DESTINATION')]
            ])('%s should forward to %s', async (to, dest) => {
                message.to = to;
                await worker.email(message, { MAP }, context);
                expect(reject).not.toHaveBeenCalled();
                expect(forward).toHaveBeenCalledWith(dest, new Headers({ [DEFAULTS.HEADER]: 'PASS' }));
            });

            it.each([
                ['user2@domain.com', DEFAULTS.FAILURE],
                ['user2+subA@domain.com', DEFAULTS.FAILURE]
            ])('%s should reject with "%s"', async (to, reason) => {
                message.to = to;
                await worker.email(message, { MAP }, context);
                expect(forward).not.toHaveBeenCalled();
                expect(reject).toHaveBeenCalledWith(reason);
            });
        });
        
        describe('Multiple users, any subaddress, domain destination, fail-forward', () => {
            const MAP = new Map();
            MAP.set('@USERS', 'user1,user2');
            MAP.set('@DESTINATION', '@email.com');
            MAP.set('@FAILURE', '+spam@email.com');

            it.each([
                ['user1@domain.com', `user1${MAP.get('@DESTINATION')}`],
                ['user1+subA@domain.com', `user1${MAP.get('@DESTINATION')}`],
                ['user2@domain.com', `user2${MAP.get('@DESTINATION')}`],
                ['user2+subA@domain.com', `user2${MAP.get('@DESTINATION')}`]
            ])('%s should forward to %s', async (to, dest) => {
                message.to = to;
                await worker.email(message, { MAP }, context);
                expect(reject).not.toHaveBeenCalled();
                expect(forward).toHaveBeenCalledWith(dest, new Headers({ [DEFAULTS.HEADER]: 'PASS' }));
            });

            it.each([
                ['user3@domain.com', `user3${MAP.get('@FAILURE')}`],
                ['user3+subA@domain.com', `user3${MAP.get('@FAILURE')}`]
            ])('%s should forward to "%s"', async (to, dest) => {
                message.to = to;
                await worker.email(message, { MAP }, context);
                expect(reject).not.toHaveBeenCalled();
                expect(forward).toHaveBeenCalledWith(dest, new Headers({ [DEFAULTS.HEADER]: 'FAIL' }));
            });
        });
        
        describe('Any user, specific subaddresses, single destination, custom reject', () => {
            const MAP = new Map();
            MAP.set('@USERS', '*');
            MAP.set('@SUBADDRESSES', 'subA,subB');
            MAP.set('@DESTINATION', 'user@email.com');
            MAP.set('@FAILURE', 'No such recipient');

            it.each([
                ['user1@domain.com', MAP.get('@DESTINATION')],
                ['user1+subA@domain.com', MAP.get('@DESTINATION')],
                ['user1+subB@domain.com', MAP.get('@DESTINATION')],
                ['userN@domain.com', MAP.get('@DESTINATION')],
                ['userN+subA@domain.com', MAP.get('@DESTINATION')],
                ['userN+subB@domain.com', MAP.get('@DESTINATION')]
            ])('%s should forward to %s', async (to, dest) => {
                message.to = to;
                await worker.email(message, { MAP }, context);
                expect(reject).not.toHaveBeenCalled();
                expect(forward).toHaveBeenCalledWith(dest, new Headers({ [DEFAULTS.HEADER]: 'PASS' }));
            });

            it.each([
                ['userN+subC@domain.com', MAP.get('@FAILURE')]            
            ])('%s should reject with "%s"', async (to, reason) => {
                message.to = to;
                await worker.email(message, { MAP }, context);
                expect(forward).not.toHaveBeenCalled();
                expect(reject).toHaveBeenCalledWith(reason);
            });
        });
        
        describe('..., custom subaddressing separator character, custom forward header', () => {
            const MAP = new Map();
            MAP.set('@USERS', 'user1');
            MAP.set('@DESTINATION', 'user@email.com');
            MAP.set('@SEPARATOR', '--');
            MAP.set('@FAILURE', 'user+spam@email.com');
            MAP.set('@HEADER', 'X-Custom');

            it.each([
                ['user1@domain.com', MAP.get('@DESTINATION')],
                ['user1--subA@domain.com', MAP.get('@DESTINATION')]
            ])('%s should forward to %s', async (to, dest) => {
                message.to = to;
                await worker.email(message, { MAP }, context);
                expect(reject).not.toHaveBeenCalled();
                expect(forward).toHaveBeenCalledWith(dest, new Headers({ [MAP.get('@HEADER')]: 'PASS' }));
            });

            it.each([
                ['user1+subA@domain.com', MAP.get('@FAILURE')],
                ['user2@domain.com', MAP.get('@FAILURE')],
                ['user2--subA@domain.com', MAP.get('@FAILURE')]
            ])('%s should forward to "%s"', async (to, dest) => {
                message.to = to;
                await worker.email(message, { MAP }, context);
                expect(reject).not.toHaveBeenCalled();
                expect(forward).toHaveBeenCalledWith(dest, new Headers({ [MAP.get('@HEADER')]: 'FAIL' }));
            });
        });
    });
    
    describe('KV users', () => {

        describe('Multiple users, any subaddress, user destination, reject', () => {
            const MAP = new Map();
            MAP.set('user1', 'user1@email.com');
            MAP.set('user2', 'user2@email.com;user2+spam@email.com');

            it.each([
                ['user1@domain.com', MAP.get('user1').split(';')[0]],
                ['user1+subA@domain.com', MAP.get('user1').split(';')[0]],
                ['user2@domain.com', MAP.get('user2').split(';')[0]],
                ['user2+subA@domain.com', MAP.get('user2').split(';')[0]]
            ])('%s should forward to %s', async (to, dest) => {
                message.to = to;
                await worker.email(message, { MAP }, context);
                expect(reject).not.toHaveBeenCalled();
                expect(forward).toHaveBeenCalledWith(dest, new Headers({ [DEFAULTS.HEADER]: 'PASS' }));
            });

            it.each([
                ['user3@domain.com', DEFAULTS.FAILURE],
                ['user3+subA@domain.com', DEFAULTS.FAILURE]
            ])('%s should reject with "%s"', async (to, reason) => {
                message.to = to;
                await worker.email(message, { MAP }, context);
                expect(forward).not.toHaveBeenCalled();
                expect(reject).toHaveBeenCalledWith(reason);
            });
        });
        
        describe('Multiple users, user subaddresses, user destination, mixed error handling', () => {
            const MAP = new Map();
            MAP.set('user1', 'user1@email.com');
            MAP.set('user1+', 'subA');
            MAP.set('user2', 'user2@email.com;user2+spam@email.com');
            MAP.set('user2+', 'subA,subB');

            it.each([
                ['user1@domain.com', MAP.get('user1').split(';')[0]],
                ['user1+subA@domain.com', MAP.get('user1').split(';')[0]],
                ['user2@domain.com', MAP.get('user2').split(';')[0]],
                ['user2+subA@domain.com', MAP.get('user2').split(';')[0]],
                ['user2+subB@domain.com', MAP.get('user2').split(';')[0]]
            ])('%s should forward to %s', async (to, dest) => {
                message.to = to;
                await worker.email(message, { MAP }, context);
                expect(reject).not.toHaveBeenCalled();
                expect(forward).toHaveBeenCalledWith(dest, new Headers({ [DEFAULTS.HEADER]: 'PASS' }));
            });

            it.each([
                ['user2+subC@domain.com', MAP.get('user2').split(';')[1]]
            ])('%s should forward to "%s"', async (to, dest) => {
                message.to = to;
                await worker.email(message, { MAP }, context);
                expect(reject).not.toHaveBeenCalled();
                expect(forward).toHaveBeenCalledWith(dest, new Headers({ [DEFAULTS.HEADER]: 'FAIL' }));
            });

            it.each([
                ['user1+subB@domain.com', DEFAULTS.FAILURE],
                ['user3@domain.com', DEFAULTS.FAILURE],
                ['user3+subA@domain.com', DEFAULTS.FAILURE]
            ])('%s should reject with "%s"', async (to, reason) => {
                message.to = to;
                await worker.email(message, { MAP }, context);
                expect(forward).not.toHaveBeenCalled();
                expect(reject).toHaveBeenCalledWith(reason);
            });
        });
    });
    
    describe('Mixed configurations', () => {
        
        describe('KV globals override environment variables', () => {
            const environment = {
                USERS: 'user1',
                DESTINATION: 'user1@email.com'
            };
            const MAP = new Map();
            MAP.set('@USERS', 'user2');
            MAP.set('@SUBADDRESSES', 'subA,subB');
            MAP.set('@DESTINATION', 'user2@email.com');
            MAP.set('@SEPARATOR', '--');
            MAP.set('@FAILURE', 'No such recipient');
            MAP.set('@HEADER', 'X-CUSTOM');
            
            it.each([
                ['user1@domain.com', MAP.get('@FAILURE')],
                ['user1--subA@domain.com', MAP.get('@FAILURE')]
            ])('%s should reject with %s', async (to, reason) => {
                message.to = to;
                await worker.email(message, { MAP, ...environment }, context);
                expect(forward).not.toHaveBeenCalled();
                expect(reject).toHaveBeenCalledWith(reason);
            });
            
            it.each([
                ['user2@domain.com', MAP.get('@DESTINATION')],
                ['user2--subA@domain.com', MAP.get('@DESTINATION')],
                ['user2--subB@domain.com', MAP.get('@DESTINATION')]
            ])('%s should forward to %s', async (to, dest) => {
                message.to = to;
                await worker.email(message, { MAP, ...environment }, context);
                expect(reject).not.toHaveBeenCalled();
                expect(forward).toHaveBeenCalledWith(dest, new Headers({ [MAP.get('@HEADER')]: 'PASS' }));
            });
            
            it.each([
                ['user2--subC@domain.com', MAP.get('@FAILURE')],
                ['user2+subA@domain.com', MAP.get('@FAILURE')]
            ])('%s should reject with %s', async (to, reason) => {
                message.to = to;
                await worker.email(message, { MAP, ...environment }, context);
                expect(forward).not.toHaveBeenCalled();
                expect(reject).toHaveBeenCalledWith(reason);
            });
        });
        
        describe('KV users override KV globals', () => {
            const MAP = new Map();
            MAP.set('@USERS', 'user1');
            MAP.set('@SUBADDRESSES', 'subA,subB');
            MAP.set('@DESTINATION', 'user1@email.com');
            MAP.set('@FAILURE', 'No such recipient');
            MAP.set('user2', 'user2@email.com');
            MAP.set('user2+', 'subC');
            MAP.set('user3', 'user3@email.com;user3+spam@email.com');
            
            it.each([
                ['user1@domain.com', MAP.get('@DESTINATION')],
                ['user1+subA@domain.com', MAP.get('@DESTINATION')],
                ['user1+subB@domain.com', MAP.get('@DESTINATION')]
            ])('%s should forward to %s', async (to, dest) => {
                message.to = to;
                await worker.email(message, { MAP }, context);
                expect(reject).not.toHaveBeenCalled();
                expect(forward).toHaveBeenCalledWith(dest, new Headers({ [DEFAULTS.HEADER]: 'PASS' }));
            });
            
            it.each([
                ['user1+subC@domain.com', MAP.get('@FAILURE')]
            ])('%s should reject with %s', async (to, reason) => {
                message.to = to;
                await worker.email(message, { MAP }, context);
                expect(forward).not.toHaveBeenCalled();
                expect(reject).toHaveBeenCalledWith(reason);
            });
            
            it.each([
                ['user2@domain.com', MAP.get('user2')],
                ['user2+subC@domain.com', MAP.get('user2')]
            ])('%s should forward to %s', async (to, dest) => {
                message.to = to;
                await worker.email(message, { MAP }, context);
                expect(reject).not.toHaveBeenCalled();
                expect(forward).toHaveBeenCalledWith(dest, new Headers({ [DEFAULTS.HEADER]: 'PASS' }));
            });
            
            it.each([
                ['user2+subA@domain.com', MAP.get('@FAILURE')],                
                ['user2+subB@domain.com', MAP.get('@FAILURE')]
            ])('%s should reject with %s', async (to, reason) => {
                message.to = to;
                await worker.email(message, { MAP }, context);
                expect(forward).not.toHaveBeenCalled();
                expect(reject).toHaveBeenCalledWith(reason);
            });
            
            it.each([
                ['user3@domain.com', MAP.get('user3').split(';')[0]],
                ['user3+subA@domain.com', MAP.get('user3').split(';')[0]],
                ['user3+subB@domain.com', MAP.get('user3').split(';')[0]]
            ])('%s should forward to %s', async (to, dest) => {
                message.to = to;
                await worker.email(message, { MAP }, context);
                expect(reject).not.toHaveBeenCalled();
                expect(forward).toHaveBeenCalledWith(dest, new Headers({ [DEFAULTS.HEADER]: 'PASS' }));
            });
            
            it.each([
                ['user3+subC@domain.com', MAP.get('user3').split(';')[1]]
            ])('%s should reject with %s', async (to, dest) => {
                message.to = to;
                await worker.email(message, { MAP }, context);
                expect(reject).not.toHaveBeenCalled();
                expect(forward).toHaveBeenCalledWith(dest, new Headers({ [DEFAULTS.HEADER]: 'FAIL' }));
            });
        });
    });
});
