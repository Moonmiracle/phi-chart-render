import * as Convert from './convert';
import utils from './convert/utils';
import { Sprite, Graphics, Text } from 'pixi.js-legacy';

export default class Chart
{
    constructor(params = {})
    {
        this.judgelines = [];
        this.notes      = [];
        this.offset     = !isNaN(Number(params.offset)) ? Number(params.offset) : 0;

        this.music      = params.music ? params.music : null;
        this.bg         = params.bg ? params.bg : null;

        this.info       = {
            name      : params.name ? params.name : 'Untitled',
            artist    : params.artist ? params.artist : 'Unknown',
            author    : params.author ? params.author : 'Unknown',
            bgAuthor  : params.bgAuthor ? params.bgAuthor : 'Unknown',
            difficult : params.difficult ? params.difficult : 'SP Lv.?'
        };

        this.sprites = {};
        this.noteJudgeCallback = null;
    }

    static from(rawChart, _chartInfo = {}, _chartLineTexture = [])
    {
        let chart;
        let chartInfo = _chartInfo;

        if (typeof rawChart == 'object')
        {
            if (!isNaN(Number(rawChart.formatVersion)))
            {
                chart = Convert.Official(rawChart);
            }
            else if (!isNaN(Number(rawChart.META.RPEVersion)))
            {
                chart = Convert.RePhiEdit(rawChart);
                chartInfo = chart.info;
            }
        }
        else if (typeof rawChart == 'string')
        {
            chart = Convert.PhiEdit(rawChart);
        }

        if (!chart) throw new Error('Unsupported chart format');

        chart.info = {
            name      : chartInfo.name ? chartInfo.name : 'Untitled',
            artist    : chartInfo.artist ? chartInfo.artist : 'Unknown',
            author    : chartInfo.author ? chartInfo.author : 'Unknown',
            bgAuthor  : chartInfo.bgAuthor ? chartInfo.bgAuthor : 'Unknown',
            difficult : chartInfo.difficult ? chartInfo.difficult : 'SP Lv.?'
        };

        chart.judgelines.forEach((judgeline) =>
        {
            judgeline.eventLayers.forEach((eventLayer) =>
            {
                /* eventLayer.speed = utils.arrangeSameSingleValueEvent(eventLayer.speed); */
                eventLayer.moveX = arrangeLineEvents(eventLayer.moveX);
                eventLayer.moveY = arrangeLineEvents(eventLayer.moveY);
                eventLayer.rotate = arrangeLineEvents(eventLayer.rotate);
                eventLayer.alpha = arrangeLineEvents(eventLayer.alpha);
            });

            for (const name in judgeline.extendEvent)
            {
                if (name !== 'color' && name !== 'text')
                    judgeline.extendEvent[name] = utils.arrangeSameValueEvent(judgeline.extendEvent[name]);
                else
                    judgeline.extendEvent[name] = utils.arrangeSameSingleValueEvent(judgeline.extendEvent[name]);
            }
            
            judgeline.sortEvent();
        });

        _chartLineTexture.forEach((lineInfo) =>
        {
            if (!chart.judgelines[lineInfo.LineId]) return;

            chart.judgelines[lineInfo.LineId].texture = lineInfo.Image;
            chart.judgelines[lineInfo.LineId].useOfficialScale = true;
            chart.judgelines[lineInfo.LineId].scaleX = !isNaN(lineInfo.Horz) ? Number(lineInfo.Horz) : 1;
            chart.judgelines[lineInfo.LineId].scaleY = !isNaN(lineInfo.Vert) ? Number(lineInfo.Vert) : 1;

            chart.judgelines[lineInfo.LineId].extendEvent.scaleX.push({
                startTime: 1 - 1000,
                endTime: 1000,
                start: chart.judgelines[lineInfo.LineId].scaleX,
                end: chart.judgelines[lineInfo.LineId].scaleX
            });

            chart.judgelines[lineInfo.LineId].extendEvent.scaleY.push({
                startTime: 1 - 1000,
                endTime: 1000,
                start: chart.judgelines[lineInfo.LineId].scaleY,
                end: chart.judgelines[lineInfo.LineId].scaleY
            });
        });

        // console.log(chart);
        return chart;
    }

    createSprites(stage, size, textures, zipFiles = {}, speed = 1, bgDim = 0.5, multiNoteHL = true, debug = false)
    {
        if (this.bg)
        {
            this.sprites.bg = new Sprite(this.bg);

            let bgCover = new Graphics();

            bgCover.beginFill(0x000000);
            bgCover.drawRect(0, 0, this.sprites.bg.texture.width, this.sprites.bg.texture.height);
            bgCover.endFill();

            bgCover.position.x = -this.sprites.bg.width / 2;
            bgCover.position.y = -this.sprites.bg.height / 2;
            bgCover.alpha = bgDim;

            this.sprites.bg.addChild(bgCover);
            this.sprites.bg.anchor.set(0.5);
            this.sprites.bg.cover = bgCover;

            stage.addChild(this.sprites.bg);
        }

        this.judgelines.forEach((judgeline, index) =>
        {
            judgeline.createSprite(textures, zipFiles, debug);

            judgeline.sprite.position.x = size.width / 2;
            judgeline.sprite.position.y = size.height / 2;
            judgeline.sprite.zIndex = index + 1;

            stage.addChild(judgeline.sprite);
            if (judgeline.debugSprite)
            {
                judgeline.debugSprite.zIndex = index + 1;
                stage.addChild(judgeline.debugSprite);
            }

            if (judgeline.texture && judgeline.useOfficialScale)
            {
                if (judgeline.extendEvent.scaleY[0].start < 0)
                {
                    let oldScaleY = judgeline.extendEvent.scaleY[0].start;

                    judgeline.extendEvent.scaleY[0].start = judgeline.extendEvent.scaleY[0].end = (1080 / judgeline.sprite.texture.baseTexture.height) * (oldScaleY * -1);
                }

                judgeline.extendEvent.scaleX[0].start = judgeline.extendEvent.scaleX[0].end = judgeline.extendEvent.scaleY[0].start * judgeline.extendEvent.scaleX[0].start;
            }
        });
        this.notes.forEach((note, index) =>
        {
            note.createSprite(textures, zipFiles, multiNoteHL, debug);

            note.sprite.zIndex = this.judgelines.length + (note.type === 3 ? index : index + 10) + 1;

            stage.addChild(note.sprite);
            if (note.debugSprite)
            {
                note.debugSprite.zIndex = note.sprite.zIndex;
                stage.addChild(note.debugSprite);
            }
        });

        this.sprites.info = {};

        this.sprites.info.songName = new Text(this.info.name + ((Math.round(speed * 100) !== 100) ? ' (x' + speed.toFixed(2) + ')' : ''), {
            fontFamily: 'A-OTF Shin Go Pr6N H',
            fill: 0xFFFFFF
        });
        this.sprites.info.songName.anchor.set(0, 1);
        this.sprites.info.songName.zIndex = 99999;

        stage.addChild(this.sprites.info.songName);


        this.sprites.info.songDiff = new Text(this.info.difficult, {
            fontFamily: 'MiSans',
            fill: 0xFFFFFF
        });
        this.sprites.info.songDiff.anchor.set(0, 1);
        this.sprites.info.songDiff.zIndex = 99999;

        stage.addChild(this.sprites.info.songDiff);
    }

    resizeSprites(size)
    {
        this.renderSize = size;

        if (this.sprites.bg)
        {
            let bgScaleWidth = this.renderSize.width / this.sprites.bg.texture.width;
            let bgScaleHeight = this.renderSize.height / this.sprites.bg.texture.height;
            let bgScale = bgScaleWidth > bgScaleHeight ? bgScaleWidth : bgScaleHeight;

            this.sprites.bg.scale.set(bgScale);
            this.sprites.bg.position.set(this.renderSize.width / 2, this.renderSize.height / 2);
        }

        if (this.judgelines && this.judgelines.length > 0)
        {
            this.judgelines.forEach((judgeline) =>
            {
                if (!judgeline.sprite) return;

                if (judgeline.isText)
                {
                    judgeline.sprite.style.fontSize = 70 * this.renderSize.heightPercent;
                }
                else
                {
                    if (judgeline.texture)
                    {
                        judgeline._width  = judgeline.sprite.texture.baseTexture.width * this.renderSize.heightPercent;
                        judgeline._height = judgeline.sprite.texture.baseTexture.height * this.renderSize.heightPercent;
                    }
                    else
                    {
                        judgeline._height = this.renderSize.lineScale * 18.75 * 0.008;
                        judgeline._width = judgeline._height * judgeline.sprite.texture.baseTexture.width / judgeline.sprite.texture.baseTexture.height * 1.042;
                    }
                    
                    judgeline.sprite.width = judgeline._width * judgeline.scaleX;
                    judgeline.sprite.height = judgeline._height * judgeline.scaleY;
                }

                judgeline.sprite.position.x = judgeline.x * this.renderSize.width;
                judgeline.sprite.position.y = judgeline.y * this.renderSize.height;

                if (judgeline.debugSprite) judgeline.debugSprite.scale.set(this.renderSize.heightPercent);
            });
        }

        if (this.notes && this.notes.length > 0)
        {
            this.notes.forEach((note) =>
            {
                if (note.type === 3)
                {
                    note.sprite.children[1].height = note.holdLength * note.speed * this.renderSize.noteSpeed / this.renderSize.noteScale;
                    note.sprite.children[2].position.y = -(note.holdLength * note.speed * this.renderSize.noteSpeed / this.renderSize.noteScale);
                }

                note.sprite.scale.set(this.renderSize.noteScale * note.xScale, this.renderSize.noteScale);
                if (note.debugSprite) note.debugSprite.scale.set(this.renderSize.heightPercent);
            });
        }

        this.sprites.info.songName.style.fontSize = size.heightPercent * 27;
        this.sprites.info.songName.position.x = size.heightPercent * 57;
        this.sprites.info.songName.position.y = size.height - size.heightPercent * 66;

        this.sprites.info.songDiff.style.fontSize = size.heightPercent * 20;
        this.sprites.info.songDiff.position.x = size.heightPercent * 57;
        this.sprites.info.songDiff.position.y = size.height - size.heightPercent * 42;
    }

    calcTime(currentTime)
    {
        this.judgelines.forEach((judgeline) =>
        {
            judgeline.calcTime(currentTime, this.renderSize);
        });
        this.notes.forEach((note) =>
        {
            note.calcTime(currentTime, this.renderSize);
            if (this.noteJudgeCallback) this.noteJudgeCallback(currentTime, note);
        })
    }

    reset()
    {
        this.judgelines.forEach((judgeline) =>
        {
            judgeline.reset();
        });
        this.notes.forEach((note) =>
        {
            note.reset();
        });
    }

    destroySprites()
    {
        this.judgelines.forEach((judgeline) =>
        {
            if (!judgeline.sprite) return;
            judgeline.sprite.destroy();
            judgeline.sprite = undefined;

            if (judgeline.debugSprite)
            {
                judgeline.debugSprite.destroy(true);
                judgeline.debugSprite = undefined;
            }
        });
        this.notes.forEach((note) =>
        {
            if (!note.sprite) return;
            note.sprite.destroy();
            note.sprite = undefined;

            if (note.debugSprite)
            {
                note.debugSprite.destroy(true);
                note.debugSprite = undefined;
            }
        });

        if (this.sprites.bg)
        {
            this.sprites.bg.destroy();
            this.sprites.bg = undefined;
        }

        this.sprites.info.songName.destroy();
        this.sprites.info.songName = undefined;

        this.sprites.info.songDiff.destroy();
        this.sprites.info.songDiff = undefined;

        this.sprites.info = undefined;
    }

    get totalNotes() {
        return this.notes.length;
    }

    get totalRealNotes() {
        let result = 0;
        this.notes.forEach((note) => {
            if (!note.isFake) result++;
        });
        return result;
    }

    get totalFakeNotes() {
        let result = 0;
        this.notes.forEach((note) => {
            if (note.isFake) result++;
        });
        return result;
    }
}


function arrangeLineEvents(events) {
    let oldEvents = events.slice();
    let newEvents2 = [];
    let newEvents = [{ // 以 -99 开始
        startTime : -99,
        endTime   : 0,
        start     : oldEvents[0] ? oldEvents[0].start : 0,
        end       : oldEvents[0] ? oldEvents[0].start : 0
    }];
    
    oldEvents.push({ // 以 1000 结束
        startTime : 0,
        endTime   : 1e3,
        start     : oldEvents[oldEvents.length - 1] ? oldEvents[oldEvents.length - 1].end : 0,
        end       : oldEvents[oldEvents.length - 1] ? oldEvents[oldEvents.length - 1].end : 0
    });
    
    // 保证时间连续性
    for (let oldEvent of oldEvents) {
        let lastNewEvent = newEvents[newEvents.length - 1];
        
        if (lastNewEvent.endTime > oldEvent.endTime)
        {
            // 忽略此分支
        }
        else if (lastNewEvent.endTime == oldEvent.startTime)
        {
            newEvents.push(oldEvent);
        }
        else if (lastNewEvent.endTime < oldEvent.startTime)
        {
            newEvents.push({
                startTime : lastNewEvent.endTime,
                endTime   : oldEvent.startTime,
                start     : lastNewEvent.end,
                end       : lastNewEvent.end
            }, oldEvent);
        }
        else if (lastNewEvent.endTime > oldEvent.startTime)
        {
            newEvents.push({
                startTime : lastNewEvent.endTime,
                endTime   : oldEvent.endTime,
                start     : (oldEvent.start * (oldEvent.endTime - lastNewEvent.endTime) + oldEvent.end * (lastNewEvent.endTime - oldEvent.startTime)) / (oldEvent.endTime - oldEvent.startTime),
                end       : lastNewEvent.end
            });
        }
    }
    
    // 合并相同变化率事件
    newEvents2 = [ newEvents.shift() ];
    for (let newEvent of newEvents)
    {
        let lastNewEvent2 = newEvents2[newEvents2.length - 1];
        let duration1 = lastNewEvent2.endTime - lastNewEvent2.startTime;
        let duration2 = newEvent.endTime - newEvent.startTime;
        
        if (newEvent.startTime == newEvent.endTime)
        {
            // 忽略此分支    
        }
        else if (
            lastNewEvent2.end == newEvent.start &&
            (lastNewEvent2.end - lastNewEvent2.start) * duration2 == (newEvent.end - newEvent.start) * duration1
        ) {
            newEvents2[newEvents2.length - 1].endTime = newEvent.endTime;
            newEvents2[newEvents2.length - 1].end     = newEvent.end;
        }
        else
        {
            newEvents2.push(newEvent);
        }
    }
    
    return newEvents.slice();
}