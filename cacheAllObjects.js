// cacheAllObjects
http = require("http");
http.globalAgent.maxSockets = 30; 
//var fs = require("./node_modules/node-fs/lib/fs");
var fsx = require('fs.extra');
var fs = require("graceful-fs")
var jsdom = require("jsdom"); 
$ = require("jquery")(jsdom.jsdom().createWindow()); 
var request = require("request");
var xmlParse = require("xml2js").parseString
var path = require("path");
console.log("trying to connect");
//var db = new CouchDB("http://localhost:8088/localhost:5984","example", {"X-Couch-Full-Commit":"false"});


var oascMatch = /<a class="oasc" href="\/research\/image-resources" title="This object is part of The Met's Open Access for Scholarly Content initiative.  Click here for additional information...">OASC<\/a>/;


var imgUrlMatch = "http://images.metmuseum.org/CRDImages/";


metRunner = require("./metRunner");

var objectCallback = function(objectJson){
//	console.log("in objectCallback");
//	console.log(objectJson);
	
	// objectnumber

  // only do for OASC objects


	var objectid = objectJson['CRDID'];

  var filedir = "objects/"+objectid.toString().substr(0,1);
  var filepath = filedir+ "/"+objectid+".json";
  console.log("filedir: " + filedir);
  if(!fs.existsSync(filedir)){
  //    console.log("dir " + dir + " not found");
      fsx.mkdirRecursiveSync(filedir, 0777);
  }






	fs.writeFile(filepath, JSON.stringify(objectJson, null, " "));


  // get image data
  // http://sgidevis00/MetDataService/MetData.asmx/getTmsPublicAccessMediaDataForObjectID?objectID=string

  var serviceUrl = "http://sgidevis00/MetDataService/MetData.asmx/getTmsPublicAccessMediaDataForObjectID?objectID="
  if(objectJson['primaryImageUrl']){

    // get local image data from MetDataService
    var imageDataUrl = serviceUrl + objectid;

    var imageUrl = objectJson['primaryImageUrl'];

    var imageFilename = path.basename(imageUrl);

    var writePath = imageUrl.replace(imgUrlMatch, "");
    console.log("*************************************** " + objectJson['primaryImageUrl']);
    console.log("imageFilename" + imageFilename);
    // do image stuff
    console.log("writepath : " + writePath);
    var imageDestDir = "images/"+ writePath.replace(/\/[^\/]+$/, "");
    console.log("imageDestDir: " + imageDestDir);
    var imageDestPath = imageDestDir + "/"+imageFilename;

    if(!fs.existsSync(imageDestDir)){

  //    console.log("dir " + dir + " not found");
      fsx.mkdirRecursiveSync(imageDestDir, 0777);
    }




    request(imageDataUrl, function(error, resp, body){
      if(error){
        console.log("in call to Met Page, got error" + error );
        callback();     
        return;
      }

      xmlParse(body,function(err, result){
        if(err){
          console.log("Error parsing xml ");
          console.log(err);
          console.log(body);
          return;
        }

        console.log("xmlparsed: got xml to json");
//        console.log(JSON.stringify(result));
        for(var i = 0; i < result.results.result.length; i++){
          var filedata = result.results.result[i];
  //        console.log(JSON.stringify(filedata));
          if(filedata.FileName == imageFilename){
            console.log("FileName: " + filedata.FileName);
            console.log("Path: " + filedata.Path);
            console.log("PublicAccess: " + filedata.PublicAccess);
            console.log("PrimaryDisplay: " + filedata.PrimaryDisplay);
            var fromFile = filedata.Path + filedata.FileName;
            var toFile = imageDestPath;
            console.log("copying from " + fromFile + " to " + toFile);
            copyFile (fromFile, toFile, function(err){
              console.log("fileCopy Error " + err);
            })
          }
        }
      });
    });
/*

    // get image from local dirs
*/


  }


}

function copyFile(source, target, cb) {
  var cbCalled = false;

  var rd = fs.createReadStream(source);
  rd.on("error", function(err) {
    done("rd "  + err);
  });
  var wr = fs.createWriteStream(target);
  wr.on("error", function(err) {
    done("wr " + err);
  });
  wr.on("close", function(ex) {
    done();
  });
  rd.pipe(wr);

  function done(err) {
    if (!cbCalled) {
      cb(err + ": tofile " + target +  " source : " + source);
      cbCalled = true;
    }
  }
}



var filterCallback = function(objectJson, successCallback, failureCallback){
	console.log("in filterCallback");
	console.log(objectJson.CRDID);

  // check for OASC
  var metUrl = "http://www.metmuseum.org/collection/the-collection-online/search/"+ objectJson.CRDID;

  console.log("calling " + metUrl);
  request(metUrl, function(error, resp, body){
    if(error){
      console.log("in call to Met Page, got error" + error );
      callback();     
      return;
    }
    console.log("got meturl");

    var is_oasc = body.match(oascMatch);
    if(is_oasc){
      console.log("IS OASC");
      successCallback(objectJson);      
    }else{
      console.log("NOT OASC!!");
      failureCallback(objectJson);
    }

  });


	

}





var finishedCallback = function(){
	console.log("in finishedCallback");

}


var metRunner = metRunner.getMetRunner({
									numObjects : 10,	
									startpage : 1,
									endpage : 6500,
									objectCallback: objectCallback, 
									filterCallback : filterCallback,
									finishedCallback : finishedCallback});


metRunner.run();









// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License. You may obtain a copy of
// the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations under
// the License.

// A simple class to represent a database. Uses XMLHttpRequest to interface with
// the CouchDB server.

function CouchDB(url, name, httpHeaders) {
  this.name = name;
  this.uri = url + "/" + encodeURIComponent(name) + "/";

  // The XMLHttpRequest object from the most recent request. Callers can
  // use this to check result http status and headers.
  this.last_req = null;

  this.request = function(method, uri, requestOptions) {
    requestOptions = requestOptions || {};
    requestOptions.headers = combine(requestOptions.headers, httpHeaders);
    return CouchDB.request(method, uri, requestOptions);
  };

  // Creates the database on the server
  this.createDb = function() {
    this.last_req = this.request("PUT", this.uri);
    CouchDB.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  };

  // Deletes the database on the server
  this.deleteDb = function() {
    this.last_req = this.request("DELETE", this.uri);
    if (this.last_req.status == 404) {
      return false;
    }
    CouchDB.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  };

  // Save a document to the database
  this.save = function(doc, options, http_headers) {
    if (doc._id == undefined) {

      doc._id = CouchDB.newUuids(1)[0];
    }
    http_headers = http_headers || {};
    this.last_req = this.request("PUT", this.uri  +
        encodeURIComponent(doc._id) + encodeOptions(options),
        {body: JSON.stringify(doc), headers: http_headers});
    CouchDB.maybeThrowError(this.last_req);
    var result = JSON.parse(this.last_req.responseText);
    doc._rev = result.rev;
    return result;
  };

  // Open a document from the database
  this.open = function(docId, url_params, http_headers) {
    this.last_req = this.request("GET", this.uri + encodeURIComponent(docId)
      + encodeOptions(url_params), {headers:http_headers});
    if (this.last_req.status == 404) {
      return null;
    }
    CouchDB.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  };

  // Deletes a document from the database
  this.deleteDoc = function(doc) {
    this.last_req = this.request("DELETE", this.uri + encodeURIComponent(doc._id)
      + "?rev=" + doc._rev);
    CouchDB.maybeThrowError(this.last_req);
    var result = JSON.parse(this.last_req.responseText);
    doc._rev = result.rev; //record rev in input document
    doc._deleted = true;
    return result;
  };

  // Deletes an attachment from a document
  this.deleteDocAttachment = function(doc, attachment_name) {
    this.last_req = this.request("DELETE", this.uri + encodeURIComponent(doc._id)
      + "/" + attachment_name + "?rev=" + doc._rev);
    CouchDB.maybeThrowError(this.last_req);
    var result = JSON.parse(this.last_req.responseText);
    doc._rev = result.rev; //record rev in input document
    return result;
  };

  this.bulkSave = function(docs, options) {
    // first prepoulate the UUIDs for new documents
    var newCount = 0;
    for (var i=0; i<docs.length; i++) {
      if (docs[i]._id == undefined) {
        newCount++;
      }
    }
    var newUuids = CouchDB.newUuids(newCount);
    var newCount = 0;
    for (var i=0; i<docs.length; i++) {
      if (docs[i]._id == undefined) {
        docs[i]._id = newUuids.pop();
      }
    }
    var json = {"docs": docs};
    // put any options in the json
    for (var option in options) {
      json[option] = options[option];
    }
    this.last_req = this.request("POST", this.uri + "_bulk_docs", {
      body: JSON.stringify(json)
    });
    if (this.last_req.status == 417) {
      return {errors: JSON.parse(this.last_req.responseText)};
    }
    else {
      CouchDB.maybeThrowError(this.last_req);
      var results = JSON.parse(this.last_req.responseText);
      for (var i = 0; i < docs.length; i++) {
        if(results[i] && results[i].rev && results[i].ok) {
          docs[i]._rev = results[i].rev;
        }
      }
      return results;
    }
  };

  this.ensureFullCommit = function() {
    this.last_req = this.request("POST", this.uri + "_ensure_full_commit");
    CouchDB.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  };

  // Applies the map function to the contents of database and returns the results.
  this.query = function(mapFun, reduceFun, options, keys, language) {
    var body = {language: language || "javascript"};
    if(keys) {
      body.keys = keys ;
    }
    if (typeof(mapFun) != "string") {
      mapFun = mapFun.toSource ? mapFun.toSource() : "(" + mapFun.toString() + ")";
    }
    body.map = mapFun;
    if (reduceFun != null) {
      if (typeof(reduceFun) != "string") {
        reduceFun = reduceFun.toSource ?
          reduceFun.toSource() : "(" + reduceFun.toString() + ")";
      }
      body.reduce = reduceFun;
    }
    if (options && options.options != undefined) {
        body.options = options.options;
        delete options.options;
    }
    this.last_req = this.request("POST", this.uri + "_temp_view"
      + encodeOptions(options), {
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body)
    });
    CouchDB.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  };

  this.view = function(viewname, options, keys) {
    var viewParts = viewname.split('/');
    var viewPath = this.uri + "_design/" + viewParts[0] + "/_view/"
        + viewParts[1] + encodeOptions(options);
    if(!keys) {
      this.last_req = this.request("GET", viewPath);
    } else {
      this.last_req = this.request("POST", viewPath, {
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({keys:keys})
      });
    }
    if (this.last_req.status == 404) {
      return null;
    }
    CouchDB.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  };

  // gets information about the database
  this.info = function() {
    this.last_req = this.request("GET", this.uri);
    CouchDB.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  };

  // gets information about a design doc
  this.designInfo = function(docid) {
    this.last_req = this.request("GET", this.uri + docid + "/_info");
    CouchDB.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  };

  this.allDocs = function(options,keys) {
    if(!keys) {
      this.last_req = this.request("GET", this.uri + "_all_docs"
        + encodeOptions(options));
    } else {
      this.last_req = this.request("POST", this.uri + "_all_docs"
        + encodeOptions(options), {
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({keys:keys})
      });
    }
    CouchDB.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  };

  this.designDocs = function() {
    return this.allDocs({startkey:"_design", endkey:"_design0"});
  };

  this.changes = function(options) {
    this.last_req = this.request("GET", this.uri + "_changes"
      + encodeOptions(options));
    CouchDB.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  };

  this.compact = function() {
    this.last_req = this.request("POST", this.uri + "_compact");
    CouchDB.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  };

  this.viewCleanup = function() {
    this.last_req = this.request("POST", this.uri + "_view_cleanup");
    CouchDB.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  };

  this.setDbProperty = function(propId, propValue) {
    this.last_req = this.request("PUT", this.uri + propId,{
      body:JSON.stringify(propValue)
    });
    CouchDB.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  };

  this.getDbProperty = function(propId) {
    this.last_req = this.request("GET", this.uri + propId);
    CouchDB.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  };

  this.setSecObj = function(secObj) {
    this.last_req = this.request("PUT", this.uri + "_security",{
      body:JSON.stringify(secObj)
    });
    CouchDB.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  };

  this.getSecObj = function() {
    this.last_req = this.request("GET", this.uri + "_security");
    CouchDB.maybeThrowError(this.last_req);
    return JSON.parse(this.last_req.responseText);
  };

  // Convert a options object to an url query string.
  // ex: {key:'value',key2:'value2'} becomes '?key="value"&key2="value2"'
  function encodeOptions(options) {
    var buf = [];
    if (typeof(options) == "object" && options !== null) {
      for (var name in options) {
        if (!options.hasOwnProperty(name)) { continue; };
        var value = options[name];
        if (name == "key" || name == "keys" || name == "startkey" || name == "endkey" || (name == "open_revs" && value !== "all")) {
          value = toJSON(value);
        }
        buf.push(encodeURIComponent(name) + "=" + encodeURIComponent(value));
      }
    }
    if (!buf.length) {
      return "";
    }
    return "?" + buf.join("&");
  }

  function toJSON(obj) {
    return obj !== null ? JSON.stringify(obj) : null;
  }

  function combine(object1, object2) {
    if (!object2) {
      return object1;
    }
    if (!object1) {
      return object2;
    }

    for (var name in object2) {
      object1[name] = object2[name];
    }
    return object1;
  }

}

// this is the XMLHttpRequest object from last request made by the following
// CouchDB.* functions (except for calls to request itself).
// Use this from callers to check HTTP status or header values of requests.
CouchDB.last_req = null;
CouchDB.urlPrefix = '';

CouchDB.login = function(name, password) {
  CouchDB.last_req = CouchDB.request("POST", "/_session", {
    headers: {"Content-Type": "application/x-www-form-urlencoded",
      "X-CouchDB-WWW-Authenticate": "Cookie"},
    body: "name=" + encodeURIComponent(name) + "&password="
      + encodeURIComponent(password)
  });
  return JSON.parse(CouchDB.last_req.responseText);
}

CouchDB.logout = function() {
  CouchDB.last_req = CouchDB.request("DELETE", "/_session", {
    headers: {"Content-Type": "application/x-www-form-urlencoded",
      "X-CouchDB-WWW-Authenticate": "Cookie"}
  });
  return JSON.parse(CouchDB.last_req.responseText);
};

CouchDB.session = function(options) {
  options = options || {};
  CouchDB.last_req = CouchDB.request("GET", "/_session", options);
  CouchDB.maybeThrowError(CouchDB.last_req);
  return JSON.parse(CouchDB.last_req.responseText);
};

CouchDB.allDbs = function() {
  CouchDB.last_req = CouchDB.request("GET", "/_all_dbs");
  CouchDB.maybeThrowError(CouchDB.last_req);
  return JSON.parse(CouchDB.last_req.responseText);
};

CouchDB.allDesignDocs = function() {
  var ddocs = {}, dbs = CouchDB.allDbs();
  for (var i=0; i < dbs.length; i++) {
    var db = new CouchDB(dbs[i]);
    ddocs[dbs[i]] = db.designDocs();
  };
  return ddocs;
};

CouchDB.getVersion = function() {
  CouchDB.last_req = CouchDB.request("GET", "/");
  CouchDB.maybeThrowError(CouchDB.last_req);
  return JSON.parse(CouchDB.last_req.responseText).version;
};

CouchDB.replicate = function(source, target, rep_options) {
  rep_options = rep_options || {};
  var headers = rep_options.headers || {};
  var body = rep_options.body || {};
  body.source = source;
  body.target = target;
  CouchDB.last_req = CouchDB.request("POST", "/_replicate", {
    headers: headers,
    body: JSON.stringify(body)
  });
  CouchDB.maybeThrowError(CouchDB.last_req);
  return JSON.parse(CouchDB.last_req.responseText);
};

CouchDB.newXhr = function() {
  if (typeof(XMLHttpRequest) != "undefined") {
    return new XMLHttpRequest();
  } else if (typeof(ActiveXObject) != "undefined") {
    return new ActiveXObject("Microsoft.XMLHTTP");
  } else {
    throw new Error("No XMLHTTPRequest support detected");
  }
};

CouchDB.request = function(method, uri, options) {
  options = typeof(options) == 'object' ? options : {};
  options.headers = typeof(options.headers) == 'object' ? options.headers : {};
  options.headers["Content-Type"] = options.headers["Content-Type"] || options.headers["content-type"] || "application/json";
  options.headers["Accept"] = options.headers["Accept"] || options.headers["accept"] || "application/json";
  var req = CouchDB.newXhr();
  if(uri.substr(0, CouchDB.protocol.length) != CouchDB.protocol) {
    uri = CouchDB.urlPrefix + uri;
  }
  req.open(method, uri, false);
  if (options.headers) {
    var headers = options.headers;
    for (var headerName in headers) {
      if (!headers.hasOwnProperty(headerName)) { continue; }
      req.setRequestHeader(headerName, headers[headerName]);
    }
  }
  req.send(options.body || "");
  return req;
};

CouchDB.requestStats = function(module, key, test) {
  var query_arg = "";
  if(test !== null) {
    query_arg = "?flush=true";
  }

  var url = "/_stats/" + module + "/" + key + query_arg;
  var stat = CouchDB.request("GET", url).responseText;
  return JSON.parse(stat)[module][key];
};

CouchDB.uuids_cache = [];

CouchDB.newUuids = function(n, buf) {
  buf = buf || 100;
  if (CouchDB.uuids_cache.length >= n) {
    var uuids = CouchDB.uuids_cache.slice(CouchDB.uuids_cache.length - n);
    if(CouchDB.uuids_cache.length - n == 0) {
      CouchDB.uuids_cache = [];
    } else {
      CouchDB.uuids_cache =
          CouchDB.uuids_cache.slice(0, CouchDB.uuids_cache.length - n);
    }
    return uuids;
  } else {
    CouchDB.last_req = CouchDB.request("GET", "/_uuids?count=" + (buf + n));
    CouchDB.maybeThrowError(CouchDB.last_req);
    var result = JSON.parse(CouchDB.last_req.responseText);
    CouchDB.uuids_cache =
        CouchDB.uuids_cache.concat(result.uuids.slice(0, buf));
    return result.uuids.slice(buf);
  }
};

CouchDB.maybeThrowError = function(req) {
  if (req.status >= 400) {
    try {
      var result = JSON.parse(req.responseText);
    } catch (ParseError) {
      var result = {error:"unknown", reason:req.responseText};
    }
    throw result;
  }
}

CouchDB.params = function(options) {
  options = options || {};
  var returnArray = [];
  for(var key in options) {
    var value = options[key];
    returnArray.push(key + "=" + value);
  }
  return returnArray.join("&");
};
// Used by replication test
if (typeof window == 'undefined' || !window) {
  CouchDB.host = "127.0.0.1:5984";
  CouchDB.protocol = "http://";
  CouchDB.inBrowser = false;
} else {
  CouchDB.host = window.location.host;
  CouchDB.inBrowser = true;
  CouchDB.protocol = window.location.protocol + "//";
}

