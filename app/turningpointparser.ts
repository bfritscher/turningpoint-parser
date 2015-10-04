///<reference path="../typings/tsd.d.ts" />

require('source-map-support').install();
import AdmZip = require('adm-zip');
import xml2js = require('xml2js');
import Sequelize = require('sequelize');
import fs = require('fs');

var sequelize = new Sequelize('postgres://' +  process.env.POSTGRES_USER + ':' +  process.env.POSTGRES_PASSWORD + '@' + process.env.POSTGRES_PORT_5432_TCP_ADDR + ':' + process.env.POSTGRES_PORT_5432_TCP_PORT + '/postgres');

// Model definition
var Session = sequelize.define('Session', {
    guid: { type: Sequelize.STRING, primaryKey: true},
    date: Sequelize.DATE,
    participantlistName: Sequelize.STRING,
    pptx: Sequelize.STRING
}, {
    timestamps: false
});


var Question = sequelize.define('Question', {
    guid: { type: Sequelize.STRING, primaryKey: true},
    session_guid: { type: Sequelize.STRING,
        references: {
            model: Session,
            key: 'guid'
        }
    },
    starttime: Sequelize.DATE,
    endtime: Sequelize.DATE,
    questiontext: Sequelize.STRING,
    correctvalue: Sequelize.INTEGER,
    incorrectvalue: Sequelize.INTEGER,
    responselimit: Sequelize.INTEGER
}, {
    timestamps: false
});

var Answer = sequelize.define('Answer', {
    index: {type: Sequelize.INTEGER, primaryKey: true},
    question_guid: { type: Sequelize.STRING, primaryKey: true,
        references: {
            model: Question,
            key: 'guid'
        }
    },
    guid: { type: Sequelize.STRING}, //not unique only index order as id
    answertext: Sequelize.STRING,
    valuetype: Sequelize.INTEGER
}, {
    timestamps: false
});

var Response = sequelize.define('Response', {
    deviceid: { type: Sequelize.STRING, primaryKey: true},
    question_guid: { type: Sequelize.STRING, primaryKey: true,
        references: {
            model: Question,
            key: 'guid'
        }
    },
    elapsed: Sequelize.INTEGER,
    responsestring: Sequelize.STRING
}, {
    timestamps: false
});

var Participant = sequelize.define('Participant', {
    deviceid: { type: Sequelize.STRING, primaryKey: true},
    participantlistName: {type: Sequelize.STRING, primaryKey: true},
    firstname: Sequelize.STRING,
    lastname: Sequelize.STRING,
    matricule: Sequelize.STRING,
    genre: Sequelize.STRING,
    status: Sequelize.STRING
}, {
    timestamps: false
});

Session.hasMany(Question, {as: 'Questions', foreignKey: 'session_guid'});
Question.hasMany(Answer, {as: 'Answers', foreignKey: 'question_guid'});
Question.hasMany(Response, {as: 'Responses', foreignKey: 'question_guid'});

sequelize.sync();

/*
//scores
SELECT  s.guid, s.pptx, s."participantlistName", s.date, r.deviceid, COUNT(DISTINCT q.guid),
SUM(CASE WHEN a.valuetype = 1 AND r.responsestring LIKE '%' || a.index || '%'
	THEN q.correctvalue ELSE q.incorrectvalue END) points,
	AVG(r.elapsed) / 1000 time_avg,
	MIN(r.elapsed) / 1000 time_min, MAX(r.elapsed) / 1000 time_max
FROM "Sessions" s JOIN "Questions" q ON s.guid = q.session_guid JOIN "Answers" a ON q.guid = a.question_guid
-- WHERE q.session_guid
LEFT JOIN "Responses" r ON q.guid = r.question_guid
GROUP BY s.guid, s.pptx, s."participantlistName", s.date, r.deviceid

*/
// Participant list parsing
export function parseTplx(path: string, callback) {
    var parser = new xml2js.Parser({explicitArray: false});
    parser.parseString(fs.readFileSync(path).toString(), (err, xml) => {
        xml.participantlist.participants.participant.forEach( participant => {
            var p = {
                deviceid: participant.devices.device,
                participantlistName: xml.participantlist.name,
                lastname: participant.lastname,
                firstname: participant.firstname
            };
            participant.custom.forEach( custom => {
                p[custom.id] = custom.text;
            });
            Participant.upsert(p);
        });
    });
}

// ZIP parsing
export function parseZip(path: string, callback) {
    var zip = new AdmZip(path);
    var zipEntries = zip.getEntries(); // an array of ZipEntry records
    var parser = new xml2js.Parser({explicitArray: false});

    var pptxName;
    zipEntries.forEach((zipEntry) => {
        if (zipEntry.entryName === 'TTSession.xml') {
            parser.parseString(zipEntry.getData().toString('utf8'), (err, xml) => {
                Session.upsert({
                    guid: xml.session.questionlist.properties.guid,
                    date: new Date(xml.session.questionlist.properties.date),
                    participantlistName: xml.session.participantlist.name,
                    pptx: pptxName
                }).then(() => {
                    xml.session.questionlist.questions.multichoice.forEach((multichoice) => {
                        Question.upsert({
                            guid: multichoice.guid,
                            session_guid: xml.session.questionlist.properties.guid,
                            starttime: new Date(multichoice.starttime),
                            endtime: new Date(multichoice.endtime),
                            questiontext: multichoice.questiontext,
                            correctvalue: multichoice.correctvalue,
                            incorrectvalue: multichoice.incorrectvalue,
                            responselimit: multichoice.responselimit
                        }).then(() => {
                            multichoice.answers.answer.forEach((answer, index) => {
                                Answer.upsert({
                                    guid: answer.guid,
                                    question_guid: multichoice.guid,
                                    index: index + 1,
                                    answertext: answer.answertext,
                                    valuetype: answer.valuetype
                                });
                            });

                            multichoice.responses.response.forEach((response) => {
                                Response.upsert({
                                    deviceid: response.deviceid,
                                    question_guid: multichoice.guid,
                                    elapsed: response.elapsed,
                                    responsestring: response.responsestring //multiple possible
                                });
                            });
                            //history
                            //multichoice.responsehistory.entry(deviceid, responses)
                        });
                    });

                    //participants
                    //xml.session.participantlist.participants.participant
                    //session
                    //xml.session.events[event(description, time)]
                });
            });
        }

        if (zipEntry.entryName.indexOf('.pptx') > -1){
            pptxName = zipEntry.entryName;
        }
    });
    if (callback){
        callback();
    }
}

export function getSessions(){
    return Session.findAll({
        include: [{ all: true }],
        order: [['date', 'ASC']]
    });
}
/*
SELECT s.guid session_guid, s.pptx session_pptx, s."participantlistName" session_participantlistname, s.date session_date,
	q.guid question_guid,  q.questiontext question_text, EXTRACT(EPOCH FROM q.endtime - q.starttime) question_time, q.responselimit question_responselimit,
	r.deviceid answer_deviceid,
	SUM(CASE WHEN a.valuetype = 1 AND r.responsestring LIKE '%' || a.index || '%'
		THEN q.correctvalue ELSE q.incorrectvalue END) answer_points,
	r.responsestring answer_given, r.elapsed / 1000 answer_time_taken,
	string_agg(CASE WHEN a.valuetype = 1 THEN CAST(a.index AS text) ELSE '' END, '' order by index) answer,
	string_agg(CASE WHEN a.valuetype = 1 THEN a.answertext || '\n' ELSE '' END, '' order by index) answer_text,
	string_agg(CASE WHEN r.responsestring LIKE '%' || a.index || '%' THEN a.answertext || '\n' ELSE '' END, '' order by index) answer_text_given

FROM "Sessions" s JOIN "Questions" q ON s.guid = q.session_guid JOIN "Answers" a ON q.guid = a.question_guid
LEFT JOIN "Responses" r ON q.guid = r.question_guid
GROUP BY s.guid, s.pptx, s."participantlistName", s.date, q.guid, q.questiontext, q.starttime, q.endtime, q.responselimit, r.deviceid, r.responsestring, r.elapsed

*/

export function getCube(){
    var cubeQuery =  'SELECT s.guid session_guid, s.pptx session_pptx, s."participantlistName" session_participantlistname, s.date session_date, '
    + 'q.guid question_guid,  q.questiontext question_text, EXTRACT(EPOCH FROM q.endtime - q.starttime) question_time, q.responselimit question_responselimit, '
    + 'r.deviceid answer_deviceid, '
    + "SUM(CASE WHEN a.valuetype = 1 AND r.responsestring LIKE '%' || a.index || '%' "
    + 'THEN q.correctvalue ELSE q.incorrectvalue END) answer_points, '
    + 'r.responsestring answer_given, r.elapsed / 1000 answer_time_taken, '
    + "string_agg(CASE WHEN a.valuetype = 1 THEN CAST(a.index AS text) ELSE '' END, '' order by index) answer, "
    + "string_agg(CASE WHEN a.valuetype = 1 THEN a.answertext || '\n' ELSE '' END, '' order by index) answer_text, "
    + "string_agg(CASE WHEN r.responsestring LIKE '%' || a.index || '%' THEN a.answertext || '\n' ELSE '' END, '' order by index) answer_text_given, "
    + 'p.lastname, p.firstname, p.matricule, p.genre '
    + 'FROM "Sessions" s JOIN "Questions" q ON s.guid = q.session_guid JOIN "Answers" a ON q.guid = a.question_guid '
    + 'LEFT JOIN "Responses" r ON q.guid = r.question_guid '
    + 'LEFT JOIN "Participants" p ON p.deviceid = r.deviceid AND p."participantlistName" = s."participantlistName" '
    + 'GROUP BY s.guid, s.pptx, s."participantlistName", s.date, q.guid, q.questiontext, q.starttime, q.endtime, q.responselimit, r.deviceid, r.responsestring, r.elapsed, p.lastname, p.firstname, p.matricule, p.genre';
    return sequelize.query(cubeQuery, { type: sequelize.QueryTypes.SELECT});
}

export function getParticipantListDetail( participantListName ) {
    var query =  'SELECT session_guid, session_pptx, session_date, answer_deviceid, lastname, firstname, matricule, genre, SUM(answer_points) answer_points, AVG(answer_time_taken) answer_avg_time_taken '
    + 'FROM (SELECT s.guid session_guid, s.pptx session_pptx, s.date session_date, '
    + 'q.guid question_guid, r.deviceid answer_deviceid, '
    + "SUM(CASE WHEN a.valuetype = 1 AND r.responsestring LIKE '%' || a.index || '%' "
    + 'THEN q.correctvalue ELSE q.incorrectvalue END) answer_points, '
    + 'r.elapsed / 1000 answer_time_taken, p.lastname, p.firstname, p.matricule, p.genre '
    + 'FROM "Sessions" s JOIN "Questions" q ON s.guid = q.session_guid JOIN "Answers" a ON q.guid = a.question_guid '
    + 'LEFT JOIN "Responses" r ON q.guid = r.question_guid '
    + 'LEFT JOIN "Participants" p ON p.deviceid = r.deviceid AND p."participantlistName" = s."participantlistName" '
    + 'WHERE s."participantlistName" = ? AND r.deviceid IS NOT NULL '
    + 'GROUP BY s.guid, s.pptx, s.date, q.guid,r.deviceid, r.responsestring, r.elapsed, p.lastname, p.firstname, p.matricule, p.genre) g '
    + 'GROUP BY session_guid, session_pptx, session_date, answer_deviceid, lastname, firstname, matricule, genre ORDER BY session_date';
    return sequelize.query( query, { replacements: [participantListName], type: sequelize.QueryTypes.SELECT} );
}

export function getParticipantLists() {
    var query = 'SELECT "participantlistName" FROM "Sessions" GROUP BY "participantlistName"';
    return sequelize.query(query, { type: sequelize.QueryTypes.SELECT});
}
