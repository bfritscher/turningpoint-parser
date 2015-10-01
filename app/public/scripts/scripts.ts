///<reference path="../../../typings/tsd.d.ts" />

declare var nv: any;

function route() {
  if (window.location.hash) {
    d3.json('participantLists/' + window.location.hash.substr(1), function(error, json) {
      if (error) {
        return console.warn(error);
      }
      displayParticipantListsDetail(json);
    });
    d3.select('body').attr('class', 'detail');
  } else {
    d3.json('participantLists', function(error, json) {
      if (error) {
        return console.warn(error);
      }
      displayParticipantLists(json);
    });
    d3.select('body').attr('class', 'main');
  }
}

window.onhashchange = route;
route();

function displayParticipantLists(json) {
  d3.select('body')
  .selectAll('p')
  .data(json)
  .enter()
  .append('p')
  .append('a')
  .attr('href', (d: any) => {
    return '#' + d.participantlistName;
  })
  .text((d: any) => {
    return d.participantlistName;
  });
}

var chartHeaders;

function displayParticipantListsDetail(json) {
  //clean data
  var lookup = {};
  var sessions = {};
  json.forEach( (item) => {
    if ( !lookup.hasOwnProperty(item.answer_deviceid) ){
        lookup[item.answer_deviceid] = {
          key: item.firstname + ' ' + item.lastname + ' (' + item.answer_deviceid + ')',
          values: [],
          total: 0
        };
    }
    if ( !sessions.hasOwnProperty(item.session_guid) ){
      sessions[item.session_guid] = {
        name: item.session_pptx,
        guid: item.session_guid,
        date: new Date(item.session_date)
      };
    }
    lookup[item.answer_deviceid].total += parseInt(item.answer_points, 10);
    item.answer_points_total = lookup[item.answer_deviceid].total;
    lookup[item.answer_deviceid].values.push(item);

  });

  var headers = Object.keys(sessions).map((key) => {
    return sessions[key];
  });
  headers = headers.sort((a, b) => {
    return a.date - b.date;
  });

  var data = Object.keys(lookup).map((key) => {
    return lookup[key];
  });

  sortData(data, 'total');
  chartHeaders = headers.map((item) => { return item.date; });
  createGraph(data, chartHeaders);
  createTable(data, headers);
}

function createGraph(data, headers) {

  nv.addGraph(function() {
    var chart = nv.models.lineChart()
      .x(function(d) { return new Date(d.session_date); })
      .y(function(d) { return parseInt(d.answer_points_total, 10); })
      .color(d3.scale.category10().range())
      .useInteractiveGuideline(true);


    chart.xAxis
      .tickValues(headers)
      .tickFormat(function(d) {
        return d3.time.format('%d.%m')( new Date(d) );
      });


    //chart.yAxis.tickFormat(d3.format(',.1%'));

    d3.select('#chart svg')
      .datum(data)
      .transition().duration(500)
      .call(chart);

    nv.utils.windowResize(chart.update);

    return chart;
  });
}

function createTable(data, headers){
  headers.unshift({text: 'Nom', guid:'id'});
  headers.push({text: 'Total', guid:'total'});
  d3.select('#score_headers')
  .selectAll('th')
  .data(headers)
  .enter()
  .append('th')
  .text((d: any, i ) => {
    if ( i > 0 && i < headers.length - 1) {
      return  d3.time.format('%d.%m')( new Date(d.date) );
    } else {
      return d.text;
    }
  })
  .on('click', (d: any) => {
    sortData(data, d.guid);
    createGraph(data, chartHeaders);
    drawTable(data, headers);

  });
  drawTable(data, headers);
}

function sortData(data, guid){
  data.sort((a, b) => {
      // sorting columns
      if(typeof guid === 'undefined' || guid === 'total'){
        return b.total - a.total;
      } else if(guid === 'id') {
        return b.key > a.key ? -1 : 1;
      } else {
        var itemA = findByGuid(guid, a.values);
        var itemB = findByGuid(guid, b.values);
        if (itemA && itemB) {
          var diff = parseInt(itemB.answer_points, 10) - parseInt(itemA.answer_points, 10);
          if ( diff === 0 ) {
            return b.key > a.key ? -1 : 1;
          } else {
            return diff;
          }
        } else if(itemA) {
          return -1000;
        } else if(itemB) {
          return 1000;
        } else {
          return b.key > a.key ? -1 : 1;
        }
      }
    });
}

function drawTable(data, headers){
  var tr = d3.select('#score_data')
  .selectAll('tr')
  .data(data);

  tr.enter()
  .append('tr');

  var td = tr.selectAll('td')
  .data((d: any) => {
    return headers.map((h) => {

      return {guid: h.guid, row: d};
    });
  });


  td
  .enter()
  .append('td')

  //update
  td.text((h: any, i) => {
    if (i === 0){
      return h.row.key;
    } else if (i + 1 === headers.length) {
      return h.row.total;
    } else {
      var item = findByGuid(h.guid, h.row.values);
      if (item) {
        return item.answer_points;
      } else {
        return 'N/A';
      }
    }
  });
}

function findByGuid(guid, list){
  for (var i = 0; i < list.length; i++) {
    if (list[i].session_guid === guid){
      return list[i];
    }
  }
}
