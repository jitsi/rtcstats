// obfuscate ip addresses which should not be stored long-term.

import SDPUtils from 'sdp';
import { v4 as uuidv4 } from 'uuid';

// Maps a network prefix to a token. The tokens are random rather than derived from the prefix, so there is
// no key that could be used to recover it, and they are generated per page load and never transmitted, so
// the same prefix maps to an unrelated token in every other session. Two addresses can therefore be compared
// for subnet equality within a session without the prefix itself being recoverable or comparable elsewhere.
const subnetTokens = new Map();

/**
 * Returns the token for a network prefix, generating one on first use.
 *
 * @param {string} prefix - The network prefix, namespaced by address family.
 * @returns {string} The token.
 */
function getSubnetToken(prefix) {
    let token = subnetTokens.get(prefix);

    if (!token) {
        token = uuidv4().replace(/-/g, '')
            .slice(0, 8);
        subnetTokens.set(prefix, token);
    }

    return token;
}

/**
 * Expands an IPv6 address to its eight groups, restoring the zeroes elided by '::' and stripping the leading
 * zeroes within each group, so that every way of writing the same address yields the same groups.
 *
 * @param {string} ip - The IPv6 address, without brackets.
 * @returns {Array<string>} The groups.
 */
function expandIPv6(ip) {
    const [ head, tail ] = ip.split('::');
    const headGroups = head ? head.split(':') : [];
    const groups = ip.indexOf('::') === -1
        ? headGroups
        : [ ...headGroups,
            ...new Array(Math.max(0, 8 - headGroups.length - (tail ? tail.split(':').length : 0))).fill('0'),
            ...tail ? tail.split(':') : [] ];

    return groups.map(group => (parseInt(group, 16) || 0).toString(16));
}

/**
 * Replaces an IP with a token for the subnet it belongs to, keeping the address family intact. IPv4 is
 * grouped by /24 and IPv6 by /64. Anything that does not parse as an address is masked outright.
 *
 * @param {*} ip
 * @returns masked IP.
 */
function obfuscateIP(ip) {
    if (ip.indexOf('[') === 0 || ip.indexOf(':') !== -1) {
        const groups = expandIPv6(ip.replace('[', '').replace(']', ''));

        if (groups.length !== 8) {
            return 'x:x:x:x:x:x:x:x';
        }

        return `${getSubnetToken(`6:${groups.slice(0, 4).join(':')}`)}:x`;
    }

    const parts = ip.split('.');

    if (parts.length !== 4) {
        return 'x.x.x.x';
    }

    return `${getSubnetToken(`4:${parts.slice(0, 3).join('.')}`)}.x`;
}

/**
 * obfuscate the ip in ice candidates. Does NOT obfuscate the ip of the TURN server to allow
 * selecting/grouping sessions by TURN server.
 * @param {*} candidate
 */
function obfuscateCandidate(candidate) {
    const cand = SDPUtils.parseCandidate(candidate);

    if (!(cand.type === 'relay' || cand.protocol === 'ssltcp')) {
        cand.ip = obfuscateIP(cand.ip);
        cand.address = obfuscateIP(cand.address);
    }
    if (cand.relatedAddress) {
        cand.relatedAddress = obfuscateIP(cand.relatedAddress);
    }

    return SDPUtils.writeCandidate(cand);
}

/**
 *
 * @param {*} sdp
 */
function obfuscateSDP(sdp) {
    const lines = SDPUtils.splitLines(sdp);

    return `${lines
        .map(line => {
            // obfuscate a=candidate, c= and a=rtcp
            if (line.indexOf('a=candidate:') === 0) {
                return `a=${obfuscateCandidate(line)}`;
            } else if (line.indexOf('c=') === 0) {
                return 'c=IN IP4 0.0.0.0';
            } else if (line.indexOf('a=rtcp:') === 0) {
                return 'a=rtcp:9 IN IP4 0.0.0.0';
            }

            return line;
        })
        .join('\r\n')
        .trim()}\r\n`;
}

/**
 *
 * @param {*} stats
 */
function obfuscateStats(stats) {
    Object.keys(stats).forEach(id => {
        const report = stats[id];

        // TODO Safari and Firefox seem to be sending empty statistic files
        if (!report) {
            return;
        }

        // obfuscate different variants of how the ip is contained in different stats / versions.
        [ 'ipAddress', 'ip', 'address' ].forEach(address => {
            if (report[address] && report.candidateType !== 'relay') {
                report[address] = obfuscateIP(report[address]);
            }
        });
        [ 'googLocalAddress', 'googRemoteAddress' ].forEach(name => {
            // contains both address and port
            let port;
            let ip;
            let splitBy;

            // These fields also have the port, separate it first and the obfuscate.
            if (report[name]) {
                // IPv6 has the following format [1fff:0:a88:85a3::ac1f]:8001
                // IPv5 has the following format 127.0.0.1:8001
                if (report[name][0] === '[') {
                    splitBy = ']:';
                } else {
                    splitBy = ':';
                }

                [ ip, port ] = report[name].split(splitBy);

                report[name] = `${obfuscateIP(ip)}:${port}`;
            }
        });
    });
}

/**
 * Obfuscates the ip addresses from webrtc statistics.
 * NOTE. The statistics spec is subject to change, consider evaluating which statistics contain IP addresses
 * before usage.
 *
 * @param {*} data
 */
export default function(data) {
    switch (data[0]) {
    case 'addIceCandidate':
    case 'onicecandidate':
        if (data[2] && data[2].candidate) {

            const jsonRepr = data[2];

            jsonRepr.candidate = obfuscateCandidate(jsonRepr.candidate);
            data[2] = jsonRepr;
        }
        break;
    case 'onicecandidateerror':
        // The url identifies the STUN/TURN server and is kept, the address is the local one the failed
        // allocation was attempted from.
        if (data[2] && data[2].address) {
            data[2].address = obfuscateIP(data[2].address);
        }
        break;
    case 'setLocalDescription':
    case 'setRemoteDescription':
    case 'createOfferOnSuccess':
    case 'createAnswerOnSuccess':
        if (data[2] && data[2].sdp) {
            data[2].sdp = obfuscateSDP(data[2].sdp);
        }
        break;
    case 'getStats':
    case 'getstats':
        if (data[2]) {
            obfuscateStats(data[2]);
        }
        break;
    default:
        break;
    }
}
