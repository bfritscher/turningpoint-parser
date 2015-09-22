/// <reference path="adm-zip/adm-zip.d.ts" />
/// <reference path="node/node.d.ts" />
/// <reference path="source-map-support/source-map-support.d.ts" />
/// <reference path="xml2js/xml2js.d.ts" />
/// <reference path="lodash/lodash.d.ts" />
/// <reference path="sequelize/sequelize.d.ts" />
/// <reference path="pg/pg.d.ts" />
/// <reference path="validator/validator.d.ts" />
/// <reference path="bluebird/bluebird.d.ts" />
/// <reference path="cors/cors.d.ts" />
/// <reference path="express/express.d.ts" />
/// <reference path="mime/mime.d.ts" />
/// <reference path="serve-static/serve-static.d.ts" />
/// <reference path="body-parser/body-parser.d.ts" />
/// <reference path="d3/d3.d.ts" />

declare module "connect-multiparty" {
    import express = require("express");
    module multiparty {
        interface Request extends express.Request {
            files:any;
        }
    }
    function multiparty(): express.RequestHandler;
    export = multiparty;
}
