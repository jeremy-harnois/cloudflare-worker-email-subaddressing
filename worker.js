/**
 * A Cloudflare email worker providing configurable email subaddressing [RFC 5233]
 *
 * Copyright (C) 2024 Jeremy Harnois
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

//
export const DEFAULTS = {
    USERS: "",
    SUBADDRESSES: "*",
    DESTINATION: "",
    SEPARATOR: "+",
    FAILURE: "Invalid recipient",
    HEADER: "X-My-Email-Subaddressing",
    // Cloudflare KV
    MAP: new Map()
};

//
export default {
    async email(message, environment, context, { implementation = (lp,scs) => lp.split(scs,2) } = {}) {
        // Environment-based configs fallback to `DEFAULTS`.
        const { USERS, SUBADDRESSES, DESTINATION, SEPARATOR, FAILURE, HEADER, MAP } = { ...DEFAULTS, ...environment }
        
        // KV-based global configs override environment-based configs (and
        // defaults) when present.
        const users = await MAP.get('@USERS') || USERS;
        let subs = await MAP.get('@SUBADDRESSES') || SUBADDRESSES;
        let dest = await MAP.get('@DESTINATION') || DESTINATION;
        let fail = await MAP.get('@FAILURE') || FAILURE;
        const header = await MAP.get('@HEADER') || HEADER;
        const separator = await MAP.get('@SEPARATOR') || SEPARATOR;
        
        // Implement "separator character sequence" against "local-part" [RFC].
        const [ user, sub ] = implementation(message.to.split('@')[0], separator);
        
        // KV-based user configs override KV-based global configs when present,
        // which override environment-based configs (and defaults) when present. 
        const mapped = await MAP.get(user);
        subs = await MAP.get(`${user}${separator}`) || subs;
        dest = mapped?.split(';').at(0) || dest;
        fail = mapped?.split(';').at(1) || fail;

        // Validate "local-part" [RFC] against configuration.
        let valid = !!mapped || '*' === users || users.replace(/\s+/g, '').split(',').includes(user);
        if (valid && sub) {
            valid = '*' === subs || subs.replace(/\s+/g, '').split(',').includes(sub);
        }
        
        //
        if (valid && dest) {
            if (dest.startsWith('@')) {
                dest = user + dest;
            }
            
            await message.forward(dest, new Headers({
                [header]: 'PASS'
            }));
        } else {
            if (/^[^A-Z0-9]/i.test(fail)) {
                fail = user + fail;
            }
            
            if (fail.includes('@')) {
                await message.forward(fail, new Headers({
                    [header]: 'FAIL'
                }));
            } else {
                message.setReject(fail);
            }
        }
    }
}
