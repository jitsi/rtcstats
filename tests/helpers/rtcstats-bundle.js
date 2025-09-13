/* eslint-disable */
var RTCStatsBundle = (function (exports) {
    'use strict';

    const PROTOCOL_ITERATION = '3.1';

    // the maximum number of ms allowed for the client to try reconnect
    const MAX_RECONNECT_TIME = 600000;
    const messageTypes = {
        SequenceNumber: 'sn'
    };
    const CONFERENCE_LEAVE_CODE = 3001;
    const DUMP_ERROR_CODE = 3002;
    const CUSTOM_ERROR_CODES = [ CONFERENCE_LEAVE_CODE, DUMP_ERROR_CODE ];

    // The limit chosen for the buffer so that memory overflows do not happen.
    const BUFFER_LIMIT = 1000;

    var constants = /*#__PURE__*/Object.freeze({
        __proto__: null,
        BUFFER_LIMIT: BUFFER_LIMIT,
        CONFERENCE_LEAVE_CODE: CONFERENCE_LEAVE_CODE,
        CUSTOM_ERROR_CODES: CUSTOM_ERROR_CODES,
        DUMP_ERROR_CODE: DUMP_ERROR_CODE,
        MAX_RECONNECT_TIME: MAX_RECONNECT_TIME,
        PROTOCOL_ITERATION: PROTOCOL_ITERATION,
        messageTypes: messageTypes
    });

    const PC_STATE_CONNECTED = 'connected';

    const PC_STATE_DISCONNECTED = 'disconnected';

    const PC_STATE_FAILED = 'failed';

    const PC_CON_STATE_CHANGE = 'connectionstatechange';

    const PC_ICE_CON_STATE_CHANGE = 'iceconnectionstatechange';

    var events = /*#__PURE__*/Object.freeze({
        __proto__: null,
        PC_CON_STATE_CHANGE: PC_CON_STATE_CHANGE,
        PC_ICE_CON_STATE_CHANGE: PC_ICE_CON_STATE_CHANGE,
        PC_STATE_CONNECTED: PC_STATE_CONNECTED,
        PC_STATE_DISCONNECTED: PC_STATE_DISCONNECTED,
        PC_STATE_FAILED: PC_STATE_FAILED
    });

    function getDefaultExportFromCjs (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
    }

    var sdp = {exports: {}};

    /* eslint-env node */

    var hasRequiredSdp;

    function requireSdp () {
    	if (hasRequiredSdp) return sdp.exports;
    	hasRequiredSdp = 1;
    	(function (module) {

    		// SDP helpers.
    		const SDPUtils = {};

    		// Generate an alphanumeric identifier for cname or mids.
    		// TODO: use UUIDs instead? https://gist.github.com/jed/982883
    		SDPUtils.generateIdentifier = function() {
    		  return Math.random().toString(36).substr(2, 10);
    		};

    		// The RTCP CNAME used by all peerconnections from the same JS.
    		SDPUtils.localCName = SDPUtils.generateIdentifier();

    		// Splits SDP into lines, dealing with both CRLF and LF.
    		SDPUtils.splitLines = function(blob) {
    		  return blob.trim().split('\n').map(line => line.trim());
    		};
    		// Splits SDP into sessionpart and mediasections. Ensures CRLF.
    		SDPUtils.splitSections = function(blob) {
    		  const parts = blob.split('\nm=');
    		  return parts.map((part, index) => (index > 0 ?
    		    'm=' + part : part).trim() + '\r\n');
    		};

    		// Returns the session description.
    		SDPUtils.getDescription = function(blob) {
    		  const sections = SDPUtils.splitSections(blob);
    		  return sections && sections[0];
    		};

    		// Returns the individual media sections.
    		SDPUtils.getMediaSections = function(blob) {
    		  const sections = SDPUtils.splitSections(blob);
    		  sections.shift();
    		  return sections;
    		};

    		// Returns lines that start with a certain prefix.
    		SDPUtils.matchPrefix = function(blob, prefix) {
    		  return SDPUtils.splitLines(blob).filter(line => line.indexOf(prefix) === 0);
    		};

    		// Parses an ICE candidate line. Sample input:
    		// candidate:702786350 2 udp 41819902 8.8.8.8 60769 typ relay raddr 8.8.8.8
    		// rport 55996"
    		// Input can be prefixed with a=.
    		SDPUtils.parseCandidate = function(line) {
    		  let parts;
    		  // Parse both variants.
    		  if (line.indexOf('a=candidate:') === 0) {
    		    parts = line.substring(12).split(' ');
    		  } else {
    		    parts = line.substring(10).split(' ');
    		  }

    		  const candidate = {
    		    foundation: parts[0],
    		    component: {1: 'rtp', 2: 'rtcp'}[parts[1]] || parts[1],
    		    protocol: parts[2].toLowerCase(),
    		    priority: parseInt(parts[3], 10),
    		    ip: parts[4],
    		    address: parts[4], // address is an alias for ip.
    		    port: parseInt(parts[5], 10),
    		    // skip parts[6] == 'typ'
    		    type: parts[7],
    		  };

    		  for (let i = 8; i < parts.length; i += 2) {
    		    switch (parts[i]) {
    		      case 'raddr':
    		        candidate.relatedAddress = parts[i + 1];
    		        break;
    		      case 'rport':
    		        candidate.relatedPort = parseInt(parts[i + 1], 10);
    		        break;
    		      case 'tcptype':
    		        candidate.tcpType = parts[i + 1];
    		        break;
    		      case 'ufrag':
    		        candidate.ufrag = parts[i + 1]; // for backward compatibility.
    		        candidate.usernameFragment = parts[i + 1];
    		        break;
    		      default: // extension handling, in particular ufrag. Don't overwrite.
    		        if (candidate[parts[i]] === undefined) {
    		          candidate[parts[i]] = parts[i + 1];
    		        }
    		        break;
    		    }
    		  }
    		  return candidate;
    		};

    		// Translates a candidate object into SDP candidate attribute.
    		// This does not include the a= prefix!
    		SDPUtils.writeCandidate = function(candidate) {
    		  const sdp = [];
    		  sdp.push(candidate.foundation);

    		  const component = candidate.component;
    		  if (component === 'rtp') {
    		    sdp.push(1);
    		  } else if (component === 'rtcp') {
    		    sdp.push(2);
    		  } else {
    		    sdp.push(component);
    		  }
    		  sdp.push(candidate.protocol.toUpperCase());
    		  sdp.push(candidate.priority);
    		  sdp.push(candidate.address || candidate.ip);
    		  sdp.push(candidate.port);

    		  const type = candidate.type;
    		  sdp.push('typ');
    		  sdp.push(type);
    		  if (type !== 'host' && candidate.relatedAddress &&
    		      candidate.relatedPort) {
    		    sdp.push('raddr');
    		    sdp.push(candidate.relatedAddress);
    		    sdp.push('rport');
    		    sdp.push(candidate.relatedPort);
    		  }
    		  if (candidate.tcpType && candidate.protocol.toLowerCase() === 'tcp') {
    		    sdp.push('tcptype');
    		    sdp.push(candidate.tcpType);
    		  }
    		  if (candidate.usernameFragment || candidate.ufrag) {
    		    sdp.push('ufrag');
    		    sdp.push(candidate.usernameFragment || candidate.ufrag);
    		  }
    		  return 'candidate:' + sdp.join(' ');
    		};

    		// Parses an ice-options line, returns an array of option tags.
    		// Sample input:
    		// a=ice-options:foo bar
    		SDPUtils.parseIceOptions = function(line) {
    		  return line.substr(14).split(' ');
    		};

    		// Parses a rtpmap line, returns RTCRtpCoddecParameters. Sample input:
    		// a=rtpmap:111 opus/48000/2
    		SDPUtils.parseRtpMap = function(line) {
    		  let parts = line.substr(9).split(' ');
    		  const parsed = {
    		    payloadType: parseInt(parts.shift(), 10), // was: id
    		  };

    		  parts = parts[0].split('/');

    		  parsed.name = parts[0];
    		  parsed.clockRate = parseInt(parts[1], 10); // was: clockrate
    		  parsed.channels = parts.length === 3 ? parseInt(parts[2], 10) : 1;
    		  // legacy alias, got renamed back to channels in ORTC.
    		  parsed.numChannels = parsed.channels;
    		  return parsed;
    		};

    		// Generates a rtpmap line from RTCRtpCodecCapability or
    		// RTCRtpCodecParameters.
    		SDPUtils.writeRtpMap = function(codec) {
    		  let pt = codec.payloadType;
    		  if (codec.preferredPayloadType !== undefined) {
    		    pt = codec.preferredPayloadType;
    		  }
    		  const channels = codec.channels || codec.numChannels || 1;
    		  return 'a=rtpmap:' + pt + ' ' + codec.name + '/' + codec.clockRate +
    		      (channels !== 1 ? '/' + channels : '') + '\r\n';
    		};

    		// Parses a extmap line (headerextension from RFC 5285). Sample input:
    		// a=extmap:2 urn:ietf:params:rtp-hdrext:toffset
    		// a=extmap:2/sendonly urn:ietf:params:rtp-hdrext:toffset
    		SDPUtils.parseExtmap = function(line) {
    		  const parts = line.substr(9).split(' ');
    		  return {
    		    id: parseInt(parts[0], 10),
    		    direction: parts[0].indexOf('/') > 0 ? parts[0].split('/')[1] : 'sendrecv',
    		    uri: parts[1],
    		  };
    		};

    		// Generates an extmap line from RTCRtpHeaderExtensionParameters or
    		// RTCRtpHeaderExtension.
    		SDPUtils.writeExtmap = function(headerExtension) {
    		  return 'a=extmap:' + (headerExtension.id || headerExtension.preferredId) +
    		      (headerExtension.direction && headerExtension.direction !== 'sendrecv'
    		        ? '/' + headerExtension.direction
    		        : '') +
    		      ' ' + headerExtension.uri + '\r\n';
    		};

    		// Parses a fmtp line, returns dictionary. Sample input:
    		// a=fmtp:96 vbr=on;cng=on
    		// Also deals with vbr=on; cng=on
    		SDPUtils.parseFmtp = function(line) {
    		  const parsed = {};
    		  let kv;
    		  const parts = line.substr(line.indexOf(' ') + 1).split(';');
    		  for (let j = 0; j < parts.length; j++) {
    		    kv = parts[j].trim().split('=');
    		    parsed[kv[0].trim()] = kv[1];
    		  }
    		  return parsed;
    		};

    		// Generates a fmtp line from RTCRtpCodecCapability or RTCRtpCodecParameters.
    		SDPUtils.writeFmtp = function(codec) {
    		  let line = '';
    		  let pt = codec.payloadType;
    		  if (codec.preferredPayloadType !== undefined) {
    		    pt = codec.preferredPayloadType;
    		  }
    		  if (codec.parameters && Object.keys(codec.parameters).length) {
    		    const params = [];
    		    Object.keys(codec.parameters).forEach(param => {
    		      if (codec.parameters[param] !== undefined) {
    		        params.push(param + '=' + codec.parameters[param]);
    		      } else {
    		        params.push(param);
    		      }
    		    });
    		    line += 'a=fmtp:' + pt + ' ' + params.join(';') + '\r\n';
    		  }
    		  return line;
    		};

    		// Parses a rtcp-fb line, returns RTCPRtcpFeedback object. Sample input:
    		// a=rtcp-fb:98 nack rpsi
    		SDPUtils.parseRtcpFb = function(line) {
    		  const parts = line.substr(line.indexOf(' ') + 1).split(' ');
    		  return {
    		    type: parts.shift(),
    		    parameter: parts.join(' '),
    		  };
    		};

    		// Generate a=rtcp-fb lines from RTCRtpCodecCapability or RTCRtpCodecParameters.
    		SDPUtils.writeRtcpFb = function(codec) {
    		  let lines = '';
    		  let pt = codec.payloadType;
    		  if (codec.preferredPayloadType !== undefined) {
    		    pt = codec.preferredPayloadType;
    		  }
    		  if (codec.rtcpFeedback && codec.rtcpFeedback.length) {
    		    // FIXME: special handling for trr-int?
    		    codec.rtcpFeedback.forEach(fb => {
    		      lines += 'a=rtcp-fb:' + pt + ' ' + fb.type +
    		      (fb.parameter && fb.parameter.length ? ' ' + fb.parameter : '') +
    		          '\r\n';
    		    });
    		  }
    		  return lines;
    		};

    		// Parses a RFC 5576 ssrc media attribute. Sample input:
    		// a=ssrc:3735928559 cname:something
    		SDPUtils.parseSsrcMedia = function(line) {
    		  const sp = line.indexOf(' ');
    		  const parts = {
    		    ssrc: parseInt(line.substr(7, sp - 7), 10),
    		  };
    		  const colon = line.indexOf(':', sp);
    		  if (colon > -1) {
    		    parts.attribute = line.substr(sp + 1, colon - sp - 1);
    		    parts.value = line.substr(colon + 1);
    		  } else {
    		    parts.attribute = line.substr(sp + 1);
    		  }
    		  return parts;
    		};

    		// Parse a ssrc-group line (see RFC 5576). Sample input:
    		// a=ssrc-group:semantics 12 34
    		SDPUtils.parseSsrcGroup = function(line) {
    		  const parts = line.substr(13).split(' ');
    		  return {
    		    semantics: parts.shift(),
    		    ssrcs: parts.map(ssrc => parseInt(ssrc, 10)),
    		  };
    		};

    		// Extracts the MID (RFC 5888) from a media section.
    		// Returns the MID or undefined if no mid line was found.
    		SDPUtils.getMid = function(mediaSection) {
    		  const mid = SDPUtils.matchPrefix(mediaSection, 'a=mid:')[0];
    		  if (mid) {
    		    return mid.substr(6);
    		  }
    		};

    		// Parses a fingerprint line for DTLS-SRTP.
    		SDPUtils.parseFingerprint = function(line) {
    		  const parts = line.substr(14).split(' ');
    		  return {
    		    algorithm: parts[0].toLowerCase(), // algorithm is case-sensitive in Edge.
    		    value: parts[1].toUpperCase(), // the definition is upper-case in RFC 4572.
    		  };
    		};

    		// Extracts DTLS parameters from SDP media section or sessionpart.
    		// FIXME: for consistency with other functions this should only
    		//   get the fingerprint line as input. See also getIceParameters.
    		SDPUtils.getDtlsParameters = function(mediaSection, sessionpart) {
    		  const lines = SDPUtils.matchPrefix(mediaSection + sessionpart,
    		    'a=fingerprint:');
    		  // Note: a=setup line is ignored since we use the 'auto' role in Edge.
    		  return {
    		    role: 'auto',
    		    fingerprints: lines.map(SDPUtils.parseFingerprint),
    		  };
    		};

    		// Serializes DTLS parameters to SDP.
    		SDPUtils.writeDtlsParameters = function(params, setupType) {
    		  let sdp = 'a=setup:' + setupType + '\r\n';
    		  params.fingerprints.forEach(fp => {
    		    sdp += 'a=fingerprint:' + fp.algorithm + ' ' + fp.value + '\r\n';
    		  });
    		  return sdp;
    		};

    		// Parses a=crypto lines into
    		//   https://rawgit.com/aboba/edgertc/master/msortc-rs4.html#dictionary-rtcsrtpsdesparameters-members
    		SDPUtils.parseCryptoLine = function(line) {
    		  const parts = line.substr(9).split(' ');
    		  return {
    		    tag: parseInt(parts[0], 10),
    		    cryptoSuite: parts[1],
    		    keyParams: parts[2],
    		    sessionParams: parts.slice(3),
    		  };
    		};

    		SDPUtils.writeCryptoLine = function(parameters) {
    		  return 'a=crypto:' + parameters.tag + ' ' +
    		    parameters.cryptoSuite + ' ' +
    		    (typeof parameters.keyParams === 'object'
    		      ? SDPUtils.writeCryptoKeyParams(parameters.keyParams)
    		      : parameters.keyParams) +
    		    (parameters.sessionParams ? ' ' + parameters.sessionParams.join(' ') : '') +
    		    '\r\n';
    		};

    		// Parses the crypto key parameters into
    		//   https://rawgit.com/aboba/edgertc/master/msortc-rs4.html#rtcsrtpkeyparam*
    		SDPUtils.parseCryptoKeyParams = function(keyParams) {
    		  if (keyParams.indexOf('inline:') !== 0) {
    		    return null;
    		  }
    		  const parts = keyParams.substr(7).split('|');
    		  return {
    		    keyMethod: 'inline',
    		    keySalt: parts[0],
    		    lifeTime: parts[1],
    		    mkiValue: parts[2] ? parts[2].split(':')[0] : undefined,
    		    mkiLength: parts[2] ? parts[2].split(':')[1] : undefined,
    		  };
    		};

    		SDPUtils.writeCryptoKeyParams = function(keyParams) {
    		  return keyParams.keyMethod + ':'
    		    + keyParams.keySalt +
    		    (keyParams.lifeTime ? '|' + keyParams.lifeTime : '') +
    		    (keyParams.mkiValue && keyParams.mkiLength
    		      ? '|' + keyParams.mkiValue + ':' + keyParams.mkiLength
    		      : '');
    		};

    		// Extracts all SDES parameters.
    		SDPUtils.getCryptoParameters = function(mediaSection, sessionpart) {
    		  const lines = SDPUtils.matchPrefix(mediaSection + sessionpart,
    		    'a=crypto:');
    		  return lines.map(SDPUtils.parseCryptoLine);
    		};

    		// Parses ICE information from SDP media section or sessionpart.
    		// FIXME: for consistency with other functions this should only
    		//   get the ice-ufrag and ice-pwd lines as input.
    		SDPUtils.getIceParameters = function(mediaSection, sessionpart) {
    		  const ufrag = SDPUtils.matchPrefix(mediaSection + sessionpart,
    		    'a=ice-ufrag:')[0];
    		  const pwd = SDPUtils.matchPrefix(mediaSection + sessionpart,
    		    'a=ice-pwd:')[0];
    		  if (!(ufrag && pwd)) {
    		    return null;
    		  }
    		  return {
    		    usernameFragment: ufrag.substr(12),
    		    password: pwd.substr(10),
    		  };
    		};

    		// Serializes ICE parameters to SDP.
    		SDPUtils.writeIceParameters = function(params) {
    		  let sdp = 'a=ice-ufrag:' + params.usernameFragment + '\r\n' +
    		      'a=ice-pwd:' + params.password + '\r\n';
    		  if (params.iceLite) {
    		    sdp += 'a=ice-lite\r\n';
    		  }
    		  return sdp;
    		};

    		// Parses the SDP media section and returns RTCRtpParameters.
    		SDPUtils.parseRtpParameters = function(mediaSection) {
    		  const description = {
    		    codecs: [],
    		    headerExtensions: [],
    		    fecMechanisms: [],
    		    rtcp: [],
    		  };
    		  const lines = SDPUtils.splitLines(mediaSection);
    		  const mline = lines[0].split(' ');
    		  for (let i = 3; i < mline.length; i++) { // find all codecs from mline[3..]
    		    const pt = mline[i];
    		    const rtpmapline = SDPUtils.matchPrefix(
    		      mediaSection, 'a=rtpmap:' + pt + ' ')[0];
    		    if (rtpmapline) {
    		      const codec = SDPUtils.parseRtpMap(rtpmapline);
    		      const fmtps = SDPUtils.matchPrefix(
    		        mediaSection, 'a=fmtp:' + pt + ' ');
    		      // Only the first a=fmtp:<pt> is considered.
    		      codec.parameters = fmtps.length ? SDPUtils.parseFmtp(fmtps[0]) : {};
    		      codec.rtcpFeedback = SDPUtils.matchPrefix(
    		        mediaSection, 'a=rtcp-fb:' + pt + ' ')
    		        .map(SDPUtils.parseRtcpFb);
    		      description.codecs.push(codec);
    		      // parse FEC mechanisms from rtpmap lines.
    		      switch (codec.name.toUpperCase()) {
    		        case 'RED':
    		        case 'ULPFEC':
    		          description.fecMechanisms.push(codec.name.toUpperCase());
    		          break;
    		      }
    		    }
    		  }
    		  SDPUtils.matchPrefix(mediaSection, 'a=extmap:').forEach(line => {
    		    description.headerExtensions.push(SDPUtils.parseExtmap(line));
    		  });
    		  // FIXME: parse rtcp.
    		  return description;
    		};

    		// Generates parts of the SDP media section describing the capabilities /
    		// parameters.
    		SDPUtils.writeRtpDescription = function(kind, caps) {
    		  let sdp = '';

    		  // Build the mline.
    		  sdp += 'm=' + kind + ' ';
    		  sdp += caps.codecs.length > 0 ? '9' : '0'; // reject if no codecs.
    		  sdp += ' UDP/TLS/RTP/SAVPF ';
    		  sdp += caps.codecs.map(codec => {
    		    if (codec.preferredPayloadType !== undefined) {
    		      return codec.preferredPayloadType;
    		    }
    		    return codec.payloadType;
    		  }).join(' ') + '\r\n';

    		  sdp += 'c=IN IP4 0.0.0.0\r\n';
    		  sdp += 'a=rtcp:9 IN IP4 0.0.0.0\r\n';

    		  // Add a=rtpmap lines for each codec. Also fmtp and rtcp-fb.
    		  caps.codecs.forEach(codec => {
    		    sdp += SDPUtils.writeRtpMap(codec);
    		    sdp += SDPUtils.writeFmtp(codec);
    		    sdp += SDPUtils.writeRtcpFb(codec);
    		  });
    		  let maxptime = 0;
    		  caps.codecs.forEach(codec => {
    		    if (codec.maxptime > maxptime) {
    		      maxptime = codec.maxptime;
    		    }
    		  });
    		  if (maxptime > 0) {
    		    sdp += 'a=maxptime:' + maxptime + '\r\n';
    		  }

    		  if (caps.headerExtensions) {
    		    caps.headerExtensions.forEach(extension => {
    		      sdp += SDPUtils.writeExtmap(extension);
    		    });
    		  }
    		  // FIXME: write fecMechanisms.
    		  return sdp;
    		};

    		// Parses the SDP media section and returns an array of
    		// RTCRtpEncodingParameters.
    		SDPUtils.parseRtpEncodingParameters = function(mediaSection) {
    		  const encodingParameters = [];
    		  const description = SDPUtils.parseRtpParameters(mediaSection);
    		  const hasRed = description.fecMechanisms.indexOf('RED') !== -1;
    		  const hasUlpfec = description.fecMechanisms.indexOf('ULPFEC') !== -1;

    		  // filter a=ssrc:... cname:, ignore PlanB-msid
    		  const ssrcs = SDPUtils.matchPrefix(mediaSection, 'a=ssrc:')
    		    .map(line => SDPUtils.parseSsrcMedia(line))
    		    .filter(parts => parts.attribute === 'cname');
    		  const primarySsrc = ssrcs.length > 0 && ssrcs[0].ssrc;
    		  let secondarySsrc;

    		  const flows = SDPUtils.matchPrefix(mediaSection, 'a=ssrc-group:FID')
    		    .map(line => {
    		      const parts = line.substr(17).split(' ');
    		      return parts.map(part => parseInt(part, 10));
    		    });
    		  if (flows.length > 0 && flows[0].length > 1 && flows[0][0] === primarySsrc) {
    		    secondarySsrc = flows[0][1];
    		  }

    		  description.codecs.forEach(codec => {
    		    if (codec.name.toUpperCase() === 'RTX' && codec.parameters.apt) {
    		      let encParam = {
    		        ssrc: primarySsrc,
    		        codecPayloadType: parseInt(codec.parameters.apt, 10),
    		      };
    		      if (primarySsrc && secondarySsrc) {
    		        encParam.rtx = {ssrc: secondarySsrc};
    		      }
    		      encodingParameters.push(encParam);
    		      if (hasRed) {
    		        encParam = JSON.parse(JSON.stringify(encParam));
    		        encParam.fec = {
    		          ssrc: primarySsrc,
    		          mechanism: hasUlpfec ? 'red+ulpfec' : 'red',
    		        };
    		        encodingParameters.push(encParam);
    		      }
    		    }
    		  });
    		  if (encodingParameters.length === 0 && primarySsrc) {
    		    encodingParameters.push({
    		      ssrc: primarySsrc,
    		    });
    		  }

    		  // we support both b=AS and b=TIAS but interpret AS as TIAS.
    		  let bandwidth = SDPUtils.matchPrefix(mediaSection, 'b=');
    		  if (bandwidth.length) {
    		    if (bandwidth[0].indexOf('b=TIAS:') === 0) {
    		      bandwidth = parseInt(bandwidth[0].substr(7), 10);
    		    } else if (bandwidth[0].indexOf('b=AS:') === 0) {
    		      // use formula from JSEP to convert b=AS to TIAS value.
    		      bandwidth = parseInt(bandwidth[0].substr(5), 10) * 1000 * 0.95
    		          - (50 * 40 * 8);
    		    } else {
    		      bandwidth = undefined;
    		    }
    		    encodingParameters.forEach(params => {
    		      params.maxBitrate = bandwidth;
    		    });
    		  }
    		  return encodingParameters;
    		};

    		// parses http://draft.ortc.org/#rtcrtcpparameters*
    		SDPUtils.parseRtcpParameters = function(mediaSection) {
    		  const rtcpParameters = {};

    		  // Gets the first SSRC. Note that with RTX there might be multiple
    		  // SSRCs.
    		  const remoteSsrc = SDPUtils.matchPrefix(mediaSection, 'a=ssrc:')
    		    .map(line => SDPUtils.parseSsrcMedia(line))
    		    .filter(obj => obj.attribute === 'cname')[0];
    		  if (remoteSsrc) {
    		    rtcpParameters.cname = remoteSsrc.value;
    		    rtcpParameters.ssrc = remoteSsrc.ssrc;
    		  }

    		  // Edge uses the compound attribute instead of reducedSize
    		  // compound is !reducedSize
    		  const rsize = SDPUtils.matchPrefix(mediaSection, 'a=rtcp-rsize');
    		  rtcpParameters.reducedSize = rsize.length > 0;
    		  rtcpParameters.compound = rsize.length === 0;

    		  // parses the rtcp-mux attrіbute.
    		  // Note that Edge does not support unmuxed RTCP.
    		  const mux = SDPUtils.matchPrefix(mediaSection, 'a=rtcp-mux');
    		  rtcpParameters.mux = mux.length > 0;

    		  return rtcpParameters;
    		};

    		SDPUtils.writeRtcpParameters = function(rtcpParameters) {
    		  let sdp = '';
    		  if (rtcpParameters.reducedSize) {
    		    sdp += 'a=rtcp-rsize\r\n';
    		  }
    		  if (rtcpParameters.mux) {
    		    sdp += 'a=rtcp-mux\r\n';
    		  }
    		  if (rtcpParameters.ssrc !== undefined && rtcpParameters.cname) {
    		    sdp += 'a=ssrc:' + rtcpParameters.ssrc +
    		      ' cname:' + rtcpParameters.cname + '\r\n';
    		  }
    		  return sdp;
    		};


    		// parses either a=msid: or a=ssrc:... msid lines and returns
    		// the id of the MediaStream and MediaStreamTrack.
    		SDPUtils.parseMsid = function(mediaSection) {
    		  let parts;
    		  const spec = SDPUtils.matchPrefix(mediaSection, 'a=msid:');
    		  if (spec.length === 1) {
    		    parts = spec[0].substr(7).split(' ');
    		    return {stream: parts[0], track: parts[1]};
    		  }
    		  const planB = SDPUtils.matchPrefix(mediaSection, 'a=ssrc:')
    		    .map(line => SDPUtils.parseSsrcMedia(line))
    		    .filter(msidParts => msidParts.attribute === 'msid');
    		  if (planB.length > 0) {
    		    parts = planB[0].value.split(' ');
    		    return {stream: parts[0], track: parts[1]};
    		  }
    		};

    		// SCTP
    		// parses draft-ietf-mmusic-sctp-sdp-26 first and falls back
    		// to draft-ietf-mmusic-sctp-sdp-05
    		SDPUtils.parseSctpDescription = function(mediaSection) {
    		  const mline = SDPUtils.parseMLine(mediaSection);
    		  const maxSizeLine = SDPUtils.matchPrefix(mediaSection, 'a=max-message-size:');
    		  let maxMessageSize;
    		  if (maxSizeLine.length > 0) {
    		    maxMessageSize = parseInt(maxSizeLine[0].substr(19), 10);
    		  }
    		  if (isNaN(maxMessageSize)) {
    		    maxMessageSize = 65536;
    		  }
    		  const sctpPort = SDPUtils.matchPrefix(mediaSection, 'a=sctp-port:');
    		  if (sctpPort.length > 0) {
    		    return {
    		      port: parseInt(sctpPort[0].substr(12), 10),
    		      protocol: mline.fmt,
    		      maxMessageSize,
    		    };
    		  }
    		  const sctpMapLines = SDPUtils.matchPrefix(mediaSection, 'a=sctpmap:');
    		  if (sctpMapLines.length > 0) {
    		    const parts = sctpMapLines[0]
    		      .substr(10)
    		      .split(' ');
    		    return {
    		      port: parseInt(parts[0], 10),
    		      protocol: parts[1],
    		      maxMessageSize,
    		    };
    		  }
    		};

    		// SCTP
    		// outputs the draft-ietf-mmusic-sctp-sdp-26 version that all browsers
    		// support by now receiving in this format, unless we originally parsed
    		// as the draft-ietf-mmusic-sctp-sdp-05 format (indicated by the m-line
    		// protocol of DTLS/SCTP -- without UDP/ or TCP/)
    		SDPUtils.writeSctpDescription = function(media, sctp) {
    		  let output = [];
    		  if (media.protocol !== 'DTLS/SCTP') {
    		    output = [
    		      'm=' + media.kind + ' 9 ' + media.protocol + ' ' + sctp.protocol + '\r\n',
    		      'c=IN IP4 0.0.0.0\r\n',
    		      'a=sctp-port:' + sctp.port + '\r\n',
    		    ];
    		  } else {
    		    output = [
    		      'm=' + media.kind + ' 9 ' + media.protocol + ' ' + sctp.port + '\r\n',
    		      'c=IN IP4 0.0.0.0\r\n',
    		      'a=sctpmap:' + sctp.port + ' ' + sctp.protocol + ' 65535\r\n',
    		    ];
    		  }
    		  if (sctp.maxMessageSize !== undefined) {
    		    output.push('a=max-message-size:' + sctp.maxMessageSize + '\r\n');
    		  }
    		  return output.join('');
    		};

    		// Generate a session ID for SDP.
    		// https://tools.ietf.org/html/draft-ietf-rtcweb-jsep-20#section-5.2.1
    		// recommends using a cryptographically random +ve 64-bit value
    		// but right now this should be acceptable and within the right range
    		SDPUtils.generateSessionId = function() {
    		  return Math.random().toString().substr(2, 21);
    		};

    		// Write boiler plate for start of SDP
    		// sessId argument is optional - if not supplied it will
    		// be generated randomly
    		// sessVersion is optional and defaults to 2
    		// sessUser is optional and defaults to 'thisisadapterortc'
    		SDPUtils.writeSessionBoilerplate = function(sessId, sessVer, sessUser) {
    		  let sessionId;
    		  const version = sessVer !== undefined ? sessVer : 2;
    		  if (sessId) {
    		    sessionId = sessId;
    		  } else {
    		    sessionId = SDPUtils.generateSessionId();
    		  }
    		  const user = sessUser || 'thisisadapterortc';
    		  // FIXME: sess-id should be an NTP timestamp.
    		  return 'v=0\r\n' +
    		      'o=' + user + ' ' + sessionId + ' ' + version +
    		        ' IN IP4 127.0.0.1\r\n' +
    		      's=-\r\n' +
    		      't=0 0\r\n';
    		};

    		// Gets the direction from the mediaSection or the sessionpart.
    		SDPUtils.getDirection = function(mediaSection, sessionpart) {
    		  // Look for sendrecv, sendonly, recvonly, inactive, default to sendrecv.
    		  const lines = SDPUtils.splitLines(mediaSection);
    		  for (let i = 0; i < lines.length; i++) {
    		    switch (lines[i]) {
    		      case 'a=sendrecv':
    		      case 'a=sendonly':
    		      case 'a=recvonly':
    		      case 'a=inactive':
    		        return lines[i].substr(2);
    		        // FIXME: What should happen here?
    		    }
    		  }
    		  if (sessionpart) {
    		    return SDPUtils.getDirection(sessionpart);
    		  }
    		  return 'sendrecv';
    		};

    		SDPUtils.getKind = function(mediaSection) {
    		  const lines = SDPUtils.splitLines(mediaSection);
    		  const mline = lines[0].split(' ');
    		  return mline[0].substr(2);
    		};

    		SDPUtils.isRejected = function(mediaSection) {
    		  return mediaSection.split(' ', 2)[1] === '0';
    		};

    		SDPUtils.parseMLine = function(mediaSection) {
    		  const lines = SDPUtils.splitLines(mediaSection);
    		  const parts = lines[0].substr(2).split(' ');
    		  return {
    		    kind: parts[0],
    		    port: parseInt(parts[1], 10),
    		    protocol: parts[2],
    		    fmt: parts.slice(3).join(' '),
    		  };
    		};

    		SDPUtils.parseOLine = function(mediaSection) {
    		  const line = SDPUtils.matchPrefix(mediaSection, 'o=')[0];
    		  const parts = line.substr(2).split(' ');
    		  return {
    		    username: parts[0],
    		    sessionId: parts[1],
    		    sessionVersion: parseInt(parts[2], 10),
    		    netType: parts[3],
    		    addressType: parts[4],
    		    address: parts[5],
    		  };
    		};

    		// a very naive interpretation of a valid SDP.
    		SDPUtils.isValidSDP = function(blob) {
    		  if (typeof blob !== 'string' || blob.length === 0) {
    		    return false;
    		  }
    		  const lines = SDPUtils.splitLines(blob);
    		  for (let i = 0; i < lines.length; i++) {
    		    if (lines[i].length < 2 || lines[i].charAt(1) !== '=') {
    		      return false;
    		    }
    		    // TODO: check the modifier a bit more.
    		  }
    		  return true;
    		};

    		// Expose public methods.
    		{
    		  module.exports = SDPUtils;
    		} 
    	} (sdp));
    	return sdp.exports;
    }

    var sdpExports = requireSdp();
    var SDPUtils = /*@__PURE__*/getDefaultExportFromCjs(sdpExports);

    // obfuscate ip addresses which should not be stored long-term.


    /**
     * Returns a simple IP mask.
     *
     * @returns masked IP.
     */
    function obfuscateIP(ip) {
        if (ip.indexOf('[') === 0 || ip.indexOf(':') !== -1) {

            return 'x:x:x:x:x:x:x:x';
        }

        return 'x.x.x.x';
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
    function obfuscator(data) {
        switch (data[0]) {
        case 'addIceCandidate':
        case 'onicecandidate':
            if (data[2] && data[2].candidate) {

                const jsonRepr = data[2];

                jsonRepr.candidate = obfuscateCandidate(jsonRepr.candidate);
                data[2] = jsonRepr;
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
        }
    }

    /**
     * Mock modules for testing RTCStats
     * These mocks replace Jitsi-specific dependencies in the test environment
     */

    /**
     * Mock BrowserDetection class for browser detection
     * Always returns Chrome/Chromium for consistent test results
     */
    class BrowserDetection {
        isChrome() {
            return true;
        }

        isFirefox() {
            return false;
        }

        isWebKit() {
            return false;
        }

        isChromiumBased() {
            return true;
        }

        isWebKitBased() {
            return false;
        }

        isReactNative() {
            return false;
        }
    }

    /* eslint-disable prefer-rest-params */
    /* eslint-disable no-param-reassign */

    /**
     * transforms a maplike to an object. Mostly for getStats + JSON.parse(JSON.stringify())
     * @param {*} m
     */
    function map2obj(m) {
        if (!m.entries) {
            return m;
        }
        const o = {};

        m.forEach((v, k) => {
            o[k] = v;
        });

        return o;
    }

    /**
     *
     * @param {*} pc
     * @param {*} response
     */
    function mangleChromeStats(pc, response) {
        const standardReport = {};
        const reports = response.result();

        reports.forEach(report => {
            const standardStats = {
                id: report.id,
                timestamp: report.timestamp.getTime(),
                type: report.type
            };

            report.names().forEach(name => {
                standardStats[name] = report.stat(name);
            });
            standardReport[standardStats.id] = standardStats;
        });

        return standardReport;
    }

    /**
     * Apply a delta compression to the stats report. Reduces size by ~90%.
     * To reduce further, report keys could be compressed.
     * @param {*} oldStats
     * @param {*} newStats
     */
    function deltaCompression(oldStats, newStatsArg) {
        const newStats = JSON.parse(JSON.stringify(newStatsArg));

        // Go through each report of the newly fetches stats entry and compare it with the previous one (old)
        // If a field value (e.g. ssrc.id) from the new report matches the corresponding one from the old report
        // delete it.
        // The new stats entry will be returned thus any reports from the old stats entry that are no longer found
        // in the new one will me considered as removed.
        // stats entries are expected to have the following format:
        // {reportName1: {
        //    key1: value,
        //    key2: value2
        // },
        // reportName2: {
        //    key1: value,
        //    key2, value2,
        // }}

        Object.keys(newStats).forEach(id => {
            const report = newStats[id];

            delete report.id;
            if (!oldStats[id]) {
                return;
            }
            Object.keys(report).forEach(name => {
                if (report[name] === oldStats[id][name]) {
                    delete newStats[id][name];
                }
            });
        });

        // TODO Snippet bellow adds the last timestamp as a stats level fields, probably used in feature extraction on the
        // rtcstats-server side, most likely not used anymore, verify if this can be removed.
        let timestamp = -Infinity;

        Object.keys(newStats).forEach(id => {
            const report = newStats[id];

            if (report.timestamp > timestamp) {
                timestamp = report.timestamp;
            }
        });
        Object.keys(newStats).forEach(id => {
            const report = newStats[id];

            if (report.timestamp === timestamp) {
                report.timestamp = 0;
            }
        });
        newStats.timestamp = timestamp;

        return newStats;
    }

    /**
     *
     * @param {*} stream
     */
    function dumpStream(stream) {
        return {
            id: stream.id,
            tracks: stream.getTracks().map(track => {
                return {
                    id: track.id, // unique identifier (GUID) for the track
                    kind: track.kind, // `audio` or `video`
                    label: track.label, // identified the track source
                    enabled: track.enabled, // application can control it
                    muted: track.muted, // application cannot control it (read-only)
                    readyState: track.readyState // `live` or `ended`
                };
            })
        };
    }

    /**
     *
     * @param {*} trace
     * @param {*} getStatsInterval
     * @param {*} prefixesToWrap
     * @param {*} connectionFilter
     */
    function rtcstats(
            { statsEntry: sendStatsEntry },
            { connectionFilter,
                pollInterval,
                useLegacy,
                sendSdp = false,
                prefixesToWrap = [ '' ],
                eventCallback }
      ) {

        console.info('[ADBG] Hello there...');
        let peerconnectioncounter = 0;

        const browserDetection = new BrowserDetection();
        const isFirefox = browserDetection.isFirefox();
        const isChromiumBased = browserDetection.isChromiumBased();
        const isWebKitBased = browserDetection.isWebKitBased();
        const isReactNative = browserDetection.isReactNative();

        // Only initialize rtcstats if it's run in a supported browser
        if (!(isFirefox || isChromiumBased || isWebKitBased || isReactNative)) {

            return;
        }

        prefixesToWrap.forEach(prefix => {
            if (!window[`${prefix}RTCPeerConnection`]) {
                return;
            }

            const OrigPeerConnection = window[`${prefix}RTCPeerConnection`];
            const peerconnection = function(config, constraints = {}) {
                // We want to make sure that any potential errors that occur at this point, caused by rtcstats logic,
                // does not affect the normal flow of any application that might integrate it.
                const origConfig = { ...config };
                const { optional = [] } = constraints;
                let isP2P = false;

                try {
                    // Verify if the connection is configured as P2P
                    optional.some(option => option.rtcStatsSFUP2P === true) && (isP2P = true);

                    const pc = new OrigPeerConnection(config, constraints);

                    // In case the client wants to skip some rtcstats connections, a filter function can be provided which
                    // will return the original PC object without any strings attached.
                    if (connectionFilter && connectionFilter(config)) {
                        return pc;
                    }

                    const id = `PC_${peerconnectioncounter++}`;

                    pc.__rtcStatsId = id;

                    if (!config) {
                        config = { nullConfig: true };
                    }

                    config = JSON.parse(JSON.stringify(config)); // deepcopy
                    // don't log credentials
                    ((config && config.iceServers) || []).forEach(server => {
                        delete server.credential;
                    });

                    if (isFirefox) {
                        config.browserType = 'moz';
                    } else {
                        config.browserType = 'webkit';
                    }

                    sendStatsEntry('create', id, config);

                    pc.__dtlsTransport = null;

                    // TODO: do we want to log constraints here? They are chrome-proprietary.
                    // eslint-disable-next-line max-len
                    // http://stackoverflow.com/questions/31003928/what-do-each-of-these-experimental-goog-rtcpeerconnectionconstraints-do
                    sendStatsEntry('constraints', id, constraints);

                    pc.addEventListener('icecandidate', e => {
                        sendStatsEntry('onicecandidate', id, e.candidate);
                    });
                    pc.addEventListener('addstream', e => {
                        sendStatsEntry(
                            'onaddstream',
                            id,
                            `${e.stream.id} ${e.stream.getTracks().map(t => `${t.kind}:${t.id}`)}`
                        );
                    });
                    pc.addEventListener('track', e => {
                        sendStatsEntry(
                            'ontrack',
                            id,
                            `${e.track.kind}:${e.track.id} ${e.streams.map(stream => `stream:${stream.id}`)}`
                        );
                    });
                    pc.addEventListener('removestream', e => {
                        sendStatsEntry(
                            'onremovestream',
                            id,
                            `${e.stream.id} ${e.stream.getTracks().map(t => `${t.kind}:${t.id}`)}`
                        );
                    });
                    pc.addEventListener('signalingstatechange', () => {
                        sendStatsEntry('onsignalingstatechange', id, pc.signalingState);
                    });
                    pc.addEventListener('iceconnectionstatechange', () => {
                        const { iceConnectionState } = pc;

                        sendStatsEntry('oniceconnectionstatechange', id, iceConnectionState);
                        eventCallback?.({
                            type: PC_ICE_CON_STATE_CHANGE,
                            body: {
                                pcId: id,
                                isP2P,
                                state: iceConnectionState
                            }
                        });
                    });
                    pc.addEventListener('icegatheringstatechange', () => {
                        sendStatsEntry('onicegatheringstatechange', id, pc.iceGatheringState);
                    });
                    pc.addEventListener('connectionstatechange', () => {
                        const { connectionState } = pc;

                        sendStatsEntry('onconnectionstatechange', id, pc.connectionState);
                        eventCallback?.({
                            type: PC_CON_STATE_CHANGE,
                            body: {
                                pcId: id,
                                isP2P,
                                state: connectionState
                            }
                        });
                    });
                    pc.addEventListener('negotiationneeded', () => {
                        sendStatsEntry('onnegotiationneeded', id, undefined);
                    });
                    pc.addEventListener('datachannel', event => {
                        sendStatsEntry('ondatachannel', id, [ event.channel.id, event.channel.label ]);
                    });

                    let prev = {};

                    const getStats = function() {
                        if (isFirefox || isWebKitBased || isReactNative || ((isChromiumBased && !useLegacy))) {
                            pc.getStats(null).then(res => {
                                const now = map2obj(res);
                                const base = JSON.parse(JSON.stringify(now)); // our new prev

                                sendStatsEntry('getstats', id, deltaCompression(prev, now));
                                prev = base;
                            });
                        } else if (isChromiumBased) {
                            // for chromium based env we have the option of using the chrome getstats api via the
                            // useLegacy flag.
                            pc.getStats(res => {
                                const now = mangleChromeStats(pc, res);
                                const base = JSON.parse(JSON.stringify(now)); // our new prev

                                sendStatsEntry('getstats', id, deltaCompression(prev, now));
                                prev = base;
                            });
                        }

                        // If the current env doesn't support any getstats call do nothing.
                    };

                    // TODO: do we want one big interval and all peerconnections
                    //    queried in that or one setInterval per PC?
                    //    we have to collect results anyway so...
                    if (pollInterval) {
                        const interval = window.setInterval(() => {
                            if (pc.signalingState === 'closed' || pc.iceConnectionState === 'closed') {
                                window.clearInterval(interval);

                                return;
                            }
                            getStats();
                        }, pollInterval);
                    }

                    pc.addEventListener('connectionstatechange', () => {
                        if ([ 'connected', 'failed' ].includes(pc.connectionState)) {
                            getStats();
                        }
                    });

                    return pc;
                } catch (error) {
                    // If something went wrong, return a normal PeerConnection
                    console.error('RTCStats PeerConnection bind failed: ', error);

                    return new OrigPeerConnection(origConfig, constraints);
                }
            };

            [ 'createDataChannel', 'close' ].forEach(method => {
                const nativeMethod = OrigPeerConnection.prototype[method];

                if (nativeMethod) {
                    OrigPeerConnection.prototype[method] = function() {
                        try {
                            sendStatsEntry(method, this.__rtcStatsId, arguments);
                        } catch (error) {
                            console.error(`RTCStats ${method} bind failed: `, error);
                        }

                        return nativeMethod.apply(this, arguments);
                    };
                }
            });

            [ 'addStream', 'removeStream' ].forEach(method => {
                const nativeMethod = OrigPeerConnection.prototype[method];

                if (nativeMethod) {
                    OrigPeerConnection.prototype[method] = function() {
                        try {
                            const stream = arguments[0];
                            const streamInfo = stream
                                .getTracks()
                                .map(t => `${t.kind}:${t.id}`)
                                .join(',');

                            sendStatsEntry(method, this.__rtcStatsId, `${stream.id} ${streamInfo}`);
                        } catch (error) {
                            console.error(`RTCStats ${method} bind failed: `, error);
                        }

                        return nativeMethod.apply(this, arguments);
                    };
                }
            });

            [ 'addTrack' ].forEach(method => {
                const nativeMethod = OrigPeerConnection.prototype[method];

                if (nativeMethod) {
                    OrigPeerConnection.prototype[method] = function() {
                        try {
                            const track = arguments[0];
                            const streams = [].slice.call(arguments, 1);

                            sendStatsEntry(
                                method,
                                this.__rtcStatsId,
                                `${track.kind}:${track.id} ${streams.map(s => `stream:${s.id}`).join(';') || '-'}`
                            );
                        } catch (error) {
                            console.error(`RTCStats ${method} bind failed: `, error);
                        }

                        return nativeMethod.apply(this, arguments);
                    };
                }
            });

            [ 'removeTrack' ].forEach(method => {
                const nativeMethod = OrigPeerConnection.prototype[method];

                if (nativeMethod) {
                    OrigPeerConnection.prototype[method] = function() {
                        try {
                            const track = arguments[0].track;

                            sendStatsEntry(method, this.__rtcStatsId, track ? `${track.kind}:${track.id}` : 'null');
                        } catch (error) {
                            console.error(`RTCStats ${method} bind failed: `, error);
                        }

                        return nativeMethod.apply(this, arguments);
                    };
                }
            });

            [ 'addTransceiver' ].forEach(method => {
                const nativeMethod = OrigPeerConnection.prototype[method];

                if (nativeMethod) {
                    OrigPeerConnection.prototype[method] = function() {
                        try {
                            const trackOrKind = arguments[0];
                            let opts;

                            if (typeof trackOrKind === 'string') {

                                opts = trackOrKind;
                            } else {
                                opts = `${trackOrKind.kind}:${trackOrKind.id}`;
                            }
                            if (arguments.length === 2 && typeof arguments[1] === 'object') {
                                opts += ` ${JSON.stringify(arguments[1])}`;
                            }

                            sendStatsEntry(method, this.__rtcStatsId, opts);
                        } catch (error) {
                            console.error(`RTCStats ${method} bind failed: `, error);
                        }

                        return nativeMethod.apply(this, arguments);
                    };
                }
            });

            [ 'createOffer', 'createAnswer' ].forEach(method => {
                const nativeMethod = OrigPeerConnection.prototype[method];

                if (nativeMethod) {
                    OrigPeerConnection.prototype[method] = function() {
                        // The logic here extracts the arguments and establishes if the API
                        // is callback or Promise based.
                        const rtcStatsId = this.__rtcStatsId;
                        const args = arguments;
                        let opts;

                        if (arguments.length === 1 && typeof arguments[0] === 'object') {
                            opts = arguments[0];
                        } else if (arguments.length === 3 && typeof arguments[2] === 'object') {
                            opts = arguments[2];
                        }

                        // We can only put a "barrier" at this point because the above logic is
                        // necessary in all cases, if something fails there we can't just bypass it.
                        try {
                            sendStatsEntry(method, this.__rtcStatsId, opts);
                        } catch (error) {
                            console.error(`RTCStats ${method} bind failed: `, error);
                        }

                        return nativeMethod.apply(this, opts ? [ opts ] : undefined).then(
                            description => {
                                try {

                                    const data = sendSdp ? description : '';

                                    sendStatsEntry(`${method}OnSuccess`, rtcStatsId, data);
                                } catch (error) {
                                    console.error(`RTCStats ${method} promise success bind failed: `, error);
                                }

                                // We can't safely bypass this part of logic because it's necessary for Proxying this
                                // request. It determines weather the call is callback or promise based.
                                if (args.length > 0 && typeof args[0] === 'function') {
                                    args[0].apply(null, [ description ]);

                                    return undefined;
                                }

                                return description;
                            },
                            err => {
                                try {
                                    sendStatsEntry(`${method}OnFailure`, rtcStatsId, err.toString());
                                } catch (error) {
                                    console.error(`RTCStats ${method} promise failure bind failed: `, error);
                                }

                                // We can't safely bypass this part of logic because it's necessary for
                                // Proxying this request. It determines weather the call is callback or promise based.
                                if (args.length > 1 && typeof args[1] === 'function') {
                                    args[1].apply(null, [ err ]);

                                    return;
                                }
                                throw err;
                            }
                        );
                    };
                }
            });

            [ 'setLocalDescription', 'setRemoteDescription', 'addIceCandidate' ].forEach(method => {
                const nativeMethod = OrigPeerConnection.prototype[method];

                if (nativeMethod) {
                    OrigPeerConnection.prototype[method] = function() {
                        const rtcStatsId = this.__rtcStatsId;
                        const args = arguments;

                        try {
                            const data = sendSdp ? args[0] : '';

                            sendStatsEntry(method, this.__rtcStatsId, data);
                        } catch (error) {
                            console.error(`RTCStats ${method} bind failed: `, error);
                        }

                        return nativeMethod.apply(this, [ args[0] ]).then(
                            () => {
                                try {
                                    sendStatsEntry(`${method}OnSuccess`, rtcStatsId, undefined);
                                } catch (error) {
                                    console.error(`RTCStats ${method} promise success bind failed: `, error);
                                }

                                if (!this.__dtlsTransport && method.endsWith('Description') && !isReactNative) {
                                    this.getSenders().forEach(sender => {
                                        if (!this.__dtlsTransport && sender.transport) {
                                            this.__dtlsTransport = sender.transport;

                                            sender.transport.addEventListener('error', error => {
                                                sendStatsEntry('ondtlserror', rtcStatsId, error);
                                            });

                                            sender.transport.addEventListener('statechange', () => {
                                                const newstate = sender.transport.state;

                                                sendStatsEntry('ondtlsstatechange', rtcStatsId, newstate);
                                            });
                                        }
                                    });
                                }

                                // We can't safely bypass this part of logic because it's necessary for
                                // Proxying this request. It determines weather the call is callback or promise based.
                                if (args.length >= 2 && typeof args[1] === 'function') {
                                    args[1].apply(null, []);

                                    return undefined;
                                }

                                return undefined;
                            },
                            err => {
                                try {
                                    sendStatsEntry(`${method}OnFailure`, rtcStatsId, err.toString());
                                } catch (error) {
                                    console.error(`RTCStats ${method} promise failure bind failed: `, error);
                                }

                                // We can't safely bypass this part of logic because it's necessary for
                                // Proxying this request. It determines weather the call is callback or promise based
                                if (args.length >= 3 && typeof args[2] === 'function') {
                                    args[2].apply(null, [ err ]);

                                    return undefined;
                                }
                                throw err;
                            }
                        );
                    };
                }
            });

            // wrap static methods. Currently just generateCertificate.
            if (OrigPeerConnection.generateCertificate) {
                Object.defineProperty(peerconnection, 'generateCertificate', {
                    get() {
                        return arguments.length
                            ? OrigPeerConnection.generateCertificate.apply(null, arguments)
                            : OrigPeerConnection.generateCertificate;
                    }
                });
            }
            window[`${prefix}RTCPeerConnection`] = peerconnection;
            window[`${prefix}RTCPeerConnection`].prototype = OrigPeerConnection.prototype;
        });

        // getUserMedia wrappers
        prefixesToWrap.forEach(prefix => {
            const name = prefix + (prefix.length ? 'GetUserMedia' : 'getUserMedia');

            if (!navigator[name]) {
                return;
            }
            const origGetUserMedia = navigator[name].bind(navigator);
            const gum = function() {
                try {
                    sendStatsEntry('getUserMedia', null, arguments[0]);
                } catch (error) {
                    console.error('RTCStats getUserMedia bind failed: ', error);
                }

                const cb = arguments[1];
                const eb = arguments[2];

                origGetUserMedia(
                    arguments[0],
                    stream => {
                        try {
                            sendStatsEntry('getUserMediaOnSuccess', null, dumpStream(stream));
                        } catch (error) {
                            console.error('RTCStats getUserMediaOnSuccess bind failed: ', error);
                        }

                        // we log the stream id, track ids and tracks readystate since that is ended GUM fails
                        // to acquire the cam (in chrome)
                        if (cb) {
                            cb(stream);
                        }
                    },
                    err => {
                        try {
                            sendStatsEntry('getUserMediaOnFailure', null, err.name);
                        } catch (error) {
                            console.error('RTCStats getUserMediaOnFailure bind failed: ', error);
                        }

                        if (eb) {
                            eb(err);
                        }
                    }
                );
            };

            navigator[name] = gum.bind(navigator);
        });

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
            const gum = function() {
                console.info('[ADBG] Totally called GUM...');

                try {
                    sendStatsEntry('navigator.mediaDevices.getUserMedia', null, arguments[0]);
                } catch (error) {
                    console.error('RTCStats navigator.mediaDevices.getUserMedia bind failed: ', error);
                }

                return origGetUserMedia.apply(navigator.mediaDevices, arguments).then(
                    stream => {
                        try {
                            sendStatsEntry('navigator.mediaDevices.getUserMediaOnSuccess', null, dumpStream(stream));
                        } catch (error) {
                            console.error('RTCStats navigator.mediaDevices.getUserMediaOnSuccess bind failed: ', error);
                        }

                        return stream;
                    },
                    err => {
                        try {
                            sendStatsEntry('navigator.mediaDevices.getUserMediaOnFailure', null, err.name);
                        } catch (error) {
                            console.error('RTCStats navigator.mediaDevices.getUserMediaOnFailure bind failed: ', error);
                        }

                        return Promise.reject(err);
                    }
                );
            };

            navigator.mediaDevices.getUserMedia = gum.bind(navigator.mediaDevices);
        }

        // getDisplayMedia
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
            const origGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
            const gdm = function() {
                try {
                    sendStatsEntry('navigator.mediaDevices.getDisplayMedia', null, arguments[0]);
                } catch (error) {
                    console.error('RTCStats navigator.mediaDevices.getDisplayMedia bind failed: ', error);
                }

                return origGetDisplayMedia.apply(navigator.mediaDevices, arguments).then(
                    stream => {
                        try {
                            sendStatsEntry('navigator.mediaDevices.getDisplayMediaOnSuccess', null, dumpStream(stream));
                        } catch (error) {
                            console.error('RTCStats navigator.mediaDevices.getDisplayMediaOnSuccess bind failed: ', error);
                        }

                        return stream;
                    },
                    err => {
                        try {
                            sendStatsEntry('navigator.mediaDevices.getDisplayMediaOnFailure', null, err.name);
                        } catch (error) {
                            console.error('RTCStats navigator.mediaDevices.getDisplayMediaOnFailure bind failed: ', error);
                        }

                        return Promise.reject(err);
                    }
                );
            };

            navigator.mediaDevices.getDisplayMedia = gdm.bind(navigator.mediaDevices);
        }
    }

    // Unique ID creation requires a high quality random # generator. In the browser we therefore
    // require the crypto API and do not support built-in fallback to lower quality random number
    // generators (like Math.random()).
    var getRandomValues;
    var rnds8 = new Uint8Array(16);
    function rng() {
      // lazy load so that environments that need to polyfill have a chance to do so
      if (!getRandomValues) {
        // getRandomValues needs to be invoked in a context where "this" is a Crypto implementation. Also,
        // find the complete implementation of crypto (msCrypto) on IE11.
        getRandomValues = typeof crypto !== 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto) || typeof msCrypto !== 'undefined' && typeof msCrypto.getRandomValues === 'function' && msCrypto.getRandomValues.bind(msCrypto);

        if (!getRandomValues) {
          throw new Error('crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported');
        }
      }

      return getRandomValues(rnds8);
    }

    var REGEX = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;

    function validate(uuid) {
      return typeof uuid === 'string' && REGEX.test(uuid);
    }

    /**
     * Convert array of 16 byte values to UUID string format of the form:
     * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
     */

    var byteToHex = [];

    for (var i = 0; i < 256; ++i) {
      byteToHex.push((i + 0x100).toString(16).substr(1));
    }

    function stringify(arr) {
      var offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
      // Note: Be careful editing this code!  It's been tuned for performance
      // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
      var uuid = (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase(); // Consistency check for valid UUID.  If this throws, it's likely due to one
      // of the following:
      // - One or more input array values don't map to a hex octet (leading to
      // "undefined" in the uuid)
      // - Invalid input values for the RFC `version` or `variant` fields

      if (!validate(uuid)) {
        throw TypeError('Stringified UUID is invalid');
      }

      return uuid;
    }

    function v4(options, buf, offset) {
      options = options || {};
      var rnds = options.random || (options.rng || rng)(); // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`

      rnds[6] = rnds[6] & 0x0f | 0x40;
      rnds[8] = rnds[8] & 0x3f | 0x80; // Copy bytes to buffer, if provided

      return stringify(rnds);
    }

    /* eslint-disable prefer-rest-params */

    /**
     * Function that returns the timeout time for the reconnect based on number of attempts.
     *
     * @param {*} reconnectAttempts
     * @returns
     */
    function getTimeout(reconnectAttempts) {
        return ((2 ** reconnectAttempts) * 1000) + Math.floor(Math.random() * 10000);
    }

    /**
     *
     * @param {*} endpoint
     * @param {*} onCloseCallback
     * @param {*} pingInterval
     */
    function traceWs({ endpoint, meetingFqn, onCloseCallback, useLegacy, obfuscate = true, pingInterval = 30000 }) {
        // Parent stats session id, used when breakout rooms occur to keep track of the initial stats session id.
        let parentStatsSessionId;

        // Buffer for storing stats if there is no connection to the server.
        let buffer = [];
        let statsSessionId = v4();
        let connection;
        let keepAliveInterval;

        // the number of ms spent trying to reconnect to the server.
        let reconnectSpentTime = 0;

        // flag indicating if data can be sent to the server.
        let canSendMessage = false;

        // The sequence number of the last stat.
        let sequenceNumber = 1;

        // Timeout time for the reconnect protocol.
        let reconnectTimeout;

        // We maintain support for legacy chrome rtcstats just in case we need some critical statistic
        // only obtainable from that format, ideally we'd remove this in the future.
        const protocolVersion = useLegacy ? `${PROTOCOL_ITERATION}_LEGACY` : `${PROTOCOL_ITERATION}_STANDARD`;

        // Function setting the timestamp and the sequence number of the entry.
        const setTransportParams = data => {
            data.push(new Date().getTime());
            data.push(sequenceNumber++);
        };

        // Function sending the message to the server if there is a connection.
        const sendMessage = msg => {
            // It creates a copy of the message so that the message from the buffer have the data attribute unstringified
            const copyMsg = Object.assign({}, msg);

            console.info('[ADBG] Trying to send a message...');


            if (copyMsg.type !== 'identity' && copyMsg.data) {
                copyMsg.data = JSON.stringify(copyMsg.data);
            }
            if (connection && (connection.readyState === WebSocket.OPEN) && canSendMessage) {
                connection.send(JSON.stringify(copyMsg));
            } else {
              console.info('[ADBG] Cant send message...');
            }
        };

        const trace = function(msg) {
            sendMessage(msg);
            if (buffer.length < BUFFER_LIMIT && msg.data) {
                buffer.push(msg);
            }
        };

        trace.isConnected = function() {
            if (!connection) {
                return false;
            }
            const { readyState } = connection;

            return readyState === WebSocket.OPEN;
        };

        trace.isClosed = function() {
            if (!connection) {
                return true;
            }

            const { readyState } = connection;

            return readyState === WebSocket.CLOSED;
        };

        trace.identity = function(...data) {
            setTransportParams(data);

            if (parentStatsSessionId) {
                data[2].parentStatsSessionId = parentStatsSessionId;
            }

            const identityMsg = {
                statsSessionId,
                type: 'identity',
                data
            };

            trace(identityMsg);
        };

        trace.statsEntry = function(...data) {
            let myData = data;

            if (obfuscate) {
                switch (data[0]) {
                case 'addIceCandidate':
                case 'onicecandidate':
                case 'setLocalDescription':
                case 'setRemoteDescription':
                    // These functions need to original values to work with
                    // so we need a deep copy to do the obfuscation on.
                    myData = JSON.parse(JSON.stringify(myData));
                    break;
                }

                // Obfuscate the ips is required.
                obfuscator(myData);
            }
            setTransportParams(myData);

            const statsEntryMsg = {
                statsSessionId,
                type: 'stats-entry',
                data: myData
            };

            trace(statsEntryMsg);
        };

        trace.keepAlive = function() {

            const keepaliveMsg = {
                statsSessionId,
                type: 'keepalive'
            };

            trace(keepaliveMsg);
        };

        trace.close = function() {
            connection && connection.close(CONFERENCE_LEAVE_CODE);
        };

        trace.connect = function(isBreakoutRoom, isReconnect = false) {
            if (isBreakoutRoom && !parentStatsSessionId) {
                parentStatsSessionId = statsSessionId;
            }
            if (parentStatsSessionId) {
                statsSessionId = v4();
                buffer.forEach(entry => {
                    entry.statsSessionId = statsSessionId;
                });
            }
            if (connection) {
                connection.close();
            }

            connection = new WebSocket(
                `${endpoint}/${meetingFqn}?statsSessionId=${statsSessionId}&isReconnect=${isReconnect}`,
                protocolVersion,
                { headers: { 'User-Agent': navigator.userAgent } }
            );

            connection.onclose = function(closeEvent) {
                keepAliveInterval && clearInterval(keepAliveInterval);
                canSendMessage && (canSendMessage = false);

                onCloseCallback({ code: closeEvent.code,
                    reason: closeEvent.reason });

                // Do not try to reconnect if connection was closed intentionally.
                if (CUSTOM_ERROR_CODES.includes(closeEvent.code)) {
                    return;
                }

                if (reconnectSpentTime < MAX_RECONNECT_TIME) {
                    const reconnectTimeoutTimeCandidate = getTimeout(reconnectSpentTime);
                    const reconnectTimeoutTime = reconnectSpentTime + reconnectTimeoutTimeCandidate < MAX_RECONNECT_TIME
                        ? reconnectTimeoutTimeCandidate
                        : MAX_RECONNECT_TIME - reconnectSpentTime;

                    reconnectSpentTime += reconnectTimeoutTime;
                    reconnectTimeout = setTimeout(() => trace.connect(isBreakoutRoom, true), reconnectTimeoutTime);
                }
            };

            connection.onopen = function() {
                keepAliveInterval = setInterval(trace.keepAlive, pingInterval);
            };

            connection.onmessage = async function(msg) {
                const { type, body } = JSON.parse(msg.data);

                // if the server sends back the last sequence number that it has been received.
                if (type === messageTypes.SequenceNumber) {
                    const { value, state } = body;

                    // if there are entries in the buffer
                    if (buffer.length) {
                        const firstSN = buffer[0].data[4];
                        const lastSN = buffer[buffer.length - 1].data[4];

                        // messages would not be in order, some messages might be missing
                        if (value < firstSN - 1 && value > lastSN) {
                            connection && connection.close(DUMP_ERROR_CODE);

                            return;
                        }

                        const lastReceivedSNIndex = buffer.findIndex(statsEntry => statsEntry.data[4] === value);

                        buffer = buffer.slice(lastReceivedSNIndex + 1);
                    }

                    // this happens when the connection is established
                    if (state === 'initial') {
                        reconnectTimeout && clearTimeout(reconnectTimeout);
                        reconnectSpentTime = 0;
                        canSendMessage = true;
                        for (let i = 0; i < buffer.length; i++) {
                            sendMessage(buffer[i]);
                        }
                    }
                }
            };
        };

        return trace;
    }

    exports.constants = constants;
    exports.events = events;
    exports.obfuscator = obfuscator;
    exports.rtcstatsInit = rtcstats;
    exports.traceInit = traceWs;

    return exports;

})({});
