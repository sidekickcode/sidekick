"use strict";

var _ = require("lodash");

exports.banner = banner;

// takes a list of paras and options. provide empty strings for spacer paras
//
// opts:
//   width: number of characters for each line width
function banner(paragraphs, opts) {
    opts = _.defaults(opts || {}, {
        width: 80,
    });

    var borderWidth = 1;
    var paddingWidth = 2;

    var spaceForText = opts.width - (paddingWidth * 2) - (borderWidth * 2);

    // add top spacer row
    paragraphs = [""].concat(paragraphs);

    var lines = _.transform(paragraphs, function (lines, para) {
        var rawLines = new Array();
        if (spacerParagraph(para)) {
            rawLines.push("");
        } else {
            rawLines = lineBreaks(spaceForText, para);
            rawLines.push("");
        }

        var formatted = _.map(rawLines, function (line) {
            return `*  ${padAlign(line, spaceForText)}  *`;
        });
        [].push.apply(lines, formatted);
    }, []);

    var verticalBorder = "*".repeat(opts.width);
    return verticalBorder + "\n" + lines.join("\n") + "\n" + verticalBorder;

    function spacerParagraph(para) {
        return para === "";
    }
}



function lineBreaks(availableWidth, text) {
    if (text.length <= availableWidth) {
        return [text];
    }

    var words = text.split(" ");
    var lines = [];

    var line;
    var currentLineLength;
    initializeLine();

    _.each(words, function (w) {
        if (lineLength(w) > availableWidth) {
            initializeLine();
        }
        line.push(w);
        currentLineLength += w.length;
    });

    return lines;
    // return _.invoke(lines, "join", " ");

    function lineLength(nextWord) {
    // spaces including that required for next word (words - 1)
        var spaces = line.length;
        return spaces + nextWord.length + currentLineLength;
    }

    function initializeLine() {
        currentLineLength = 0;
        line = [];
        lines.push(line);
    }
}

function padAlign(str, w) {
    if (str.length > w) {
        throw new Error("can't pad string over available width");
    }

    var paddingRight = (w - str.length) / 2;
    var paddingLeft;

    if (paddingRight.toFixed(0) !== paddingRight.toString()) {
        paddingRight = Math.floor(paddingRight);
        paddingLeft = paddingRight + 1;
    } else {
        paddingLeft = paddingRight;
    }

    return " ".repeat(paddingLeft) + str + " ".repeat(paddingRight);
}

