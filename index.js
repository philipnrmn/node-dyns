var request = require('request');
var url = require('url');
var conf = require('nconf');
var logger = require('winston');

var ipAddress;

conf.argv().env().file({file: './config.json'});

logger.add(logger.transports.File, {
    filename: conf.get('log'),
    level: conf.get('log_level'),
    handleExceptions: true
});
logger.exitOnError = false;

function update(options) {
    var requestURL = url.format({
        protocol: 'http',
        hostname: 'www.dyns.net',
        pathname: 'postscript011.php',
        query: options
    });

    logger.debug('Request url', requestURL);

    request({
        url: requestURL,
        headers: { 'User-Agent': 'node-dyns' }
    }, function(error, response, body) {
        if (error) {
            logger.error('Update encountered an error:', error.message);
            return;
        }
        if (response.statusCode !== 200) {
            logger.error('Unexpected status code from server:', response.statusCode);
            return;
        }

        logger.debug('Response body:', body);

        var responseCode = parseInt(body.slice(0, 3));
        var responseText = body.slice(4);

        switch(responseCode) {
            case 200:
                var responseIPMatch = responseText.match(/\d+\.\d+\.\d+\.\d+/);
                var responseIP = (responseIPMatch === -1) ? null : responseIPMatch[0];
                if (ipAddress !== responseIP) {
                    logger.info('IP address was updated from', ipAddress, 'to', responseIP);
                    ipAddress = responseIP;
                }
                break;
            case 400:
                logger.error('The URL was malformed, one of the required parameters was not supplied or the IP ' +
                             'address you supplied in your request is invalid. Change your HTTP request. ');
                break;
            case 402:
                var nMatch = responseText.match(/\d+/);
                var n = (nMatch === -1) ? 'unknown' : nMatch[0];
                logger.warn('Your update was too fast. The query is discarded. Wait at least', n, 'seconds and try again');
                break;
            case 403:
                logger.warn('There was a server-side database error. Try again in a few moments. ');
                break;
            case 405:
                logger.error('The hostname you want to update is either nonexisting, or you are not owner of this ' + 
                             'hostname. Change your HTTP request. ');
                break;
            default:
                logger.error('Unknown status code encountered:', response.statusCode);
                break;
        }
    });
}

logger.info('node-dyns client is running with updates every', conf.get('interval'), 'seconds');
setInterval(function updateOnInterval() {
    update({
        username: conf.get('username'),
        password: conf.get('password'),
        host: conf.get('hostname'), // NB: host not hostname per docs
        domain: conf.get('domain'),
        devel: parseInt(conf.get('dev_mode'))
    });
}, conf.get('interval') * 1000);


