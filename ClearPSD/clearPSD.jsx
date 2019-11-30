// ----------------------------- 
// by yangshuang
//
#target photoshop

#script "PSD Clear Tools"

$.localize = true;

var progress_info = null;

const VERSION = "ver 1.0";

const TITTLES = [
	"PSD整理小助手",
	"控制选项",
	"忽略隐藏图层",
	"命名填充",
]

const TIPS = [
	"处理流程： \n 1.拷贝文档，隔绝影响 \n 2.重新命名"
]

const PROCESS_TITTLES = [
	"处理信息，请稍后"
]

const PROCESS_MSG = [
	"准备中",
	"自动分析中",
	"重新命名"
]


var originDocRef = null;
var exportDocRef = null;

function generateNameManager (_number){
	var currentNumber = 1;
	var totalNumber = _number;
	var currentCharCode = "a".charCodeAt();
	return {
		nextNumber:function(){
			var numStr = currentNumber.toString();
			while(numStr.length < _number.length){
				numStr = "0" + numStr;
			}
			currentNumber++;
			return numStr;
		},
		nextPad:function(){
			var pad = String.fromCharCode(currentCharCode);
			currentCharCode++;
			if (currentCharCode > "z".charCodeAt()) {
				currentCharCode = "a".charCodeAt();
			}
			return pad;
		},
		getPercent:function() {
			return currentNumber/totalNumber;
		}
	}
}

run();

function run () {
	try {
		var config = {
			serial:"_rename_",
			ignoreHiddenLayer:true,
			cancel:false,
			ui:{
				main_ui:null,
				progress_ui:null,
			},
		};

		originDocRef = app.activeDocument;

		_UI_main_(config);

	} catch(e) {
		alert(e);
	}
}

function _UI_main_ (_config) {
	app.bringToFront();
	var main_ui = new Window("dialog",TITTLES[0] + VERSION);
	_config.ui.main_ui = main_ui;
	main_ui.graphics.backgroundColor = main_ui.graphics.newBrush(main_ui.graphics.BrushType.THEME_COLOR,"appDialogBackground");
	main_ui.orientation = "column";
	main_ui.alignment = ["fill","fill"];


	var optionPanel = main_ui.add("panel",undefined,TITTLES[1]);
	optionPanel.helpTip = TIPS[0];

	var checkGroup = optionPanel.add("group");
	checkGroup.alignment = ["left","file"];
	var ignoreHiddenLayersCheckox = checkGroup.add("checkbox",undefined,TITTLES[2]);
	ignoreHiddenLayersCheckox.value = _config.ignoreHiddenLayer;
	ignoreHiddenLayersCheckox.onChange = function(){
		_config.ignoreHiddenLayer = this.value;
	}
	main_ui.ignoreHiddenLayersCheckox = ignoreHiddenLayersCheckox;


	var serialGroup = optionPanel.add("group");
	serialGroup.orientation = "row";
	var statictextSerial = serialGroup.add("statictext",undefined,TITTLES[2]);
	var edittextSerial = serialGroup.add("edittext",undefined,_config.serial);
	edittextSerial.preferredSize.width = 125;
	edittextSerial.onChange = function(){
		_config.serial = edittextSerial.text;
	}
	main_ui.edittextSerial = edittextSerial;

	var group = main_ui.add("group");
	group.alignment="center";
	var okButton = group.add("button",undefined,"ok");
	var cancelButton = group.add("button",undefined,"cancel");

	okButton.onClick = function () {
		_UI_progress_(_config)
		process(_config);
		okButton.enable = false;
	};
	
	main_ui.center();
	
	var status = main_ui.show();
	return status;
}

function _UI_progress_ (_config) {
	var palette_ui = new Window("palette",PROCESS_TITTLES[0]);
	palette_ui.alignChildren = "fill";
	palette_ui.orientation = "column";
	
	var message_ui = palette_ui.add("statictext", undefined,PROCESS_MSG[0]);
	var group = palette_ui.add("group");

	var bar_ui = group.add("progressbar");
	bar_ui.preferredSize = [512, 28];
	bar_ui.minvalue = 0;
	bar_ui.maxvalue = 100;
	bar_ui.value = 0;
	var cancelButton = group.add("button", undefined, "cancel");
	cancelButton.onClick = function () {
		_config.cancel = true;
		palette_ui.close();
		if (exportDocRef) {
			exportDocRef.close(SaveOptions.DONOTSAVECHANGES);
		}
		cancelButton.enabled = false;
		return;
	};

	palette_ui.center();
	palette_ui.show();
	palette_ui.active = true;

	_config.ui.progress_ui = {
		palette_ui:palette_ui,
		bar_ui:bar_ui,
		message_ui:message_ui,
	};
}

function _update_UI_progress(_config,_message,_percent){
		if (!_config.ui.progress_ui.palette_ui.active) {
			_config.ui.progress_ui.palette_ui.active = true;
		}
		_config.ui.progress_ui.message_ui.text = _message;
		_config.ui.progress_ui.bar_ui.value = _percent * _config.ui.progress_ui.bar_ui.maxvalue;
		_config.ui.progress_ui.palette_ui.show();
}

function process (_config) {
	try {
		_update_UI_progress(_config,PROCESS_MSG[0],0);

		var originRulerUnits = app.preferences.rulerUnits;
		var originTypeUnits = app.preferences.typeUnits;
		var originDisplayDialogs = app.displayDialogs;

		app.preferences.rulerUnits = Units.PIXELS;
		app.preferences.typeUnits = TypeUnits.PIXELS;
		app.preferences.displayDialogs = DialogModes.NO;

		exportDocRef = originDocRef.duplicate("_" + originDocRef.name);
		app.activeDocument = exportDocRef;

		if (ExternalObject.AdobeXMPScript == undefined) {
			ExternalObject.AdobeXMPScript = new ExternalObject("lib:AdobeXMPScript");
		}
		var xmpRef = new XMPMeta(exportDocRef.xmpMetadata.rawData);
		XMPUtils.removeProperties(xmpRef,"","",XMPConst.REMOVE_ALL_PROPERITES);
		exportDocRef.xmpMetadata.rawData = xmpRef.serialize();

		_update_UI_progress(_config,PROCESS_MSG[1],0);
		parse(exportDocRef.layers,_config);

		app.preferences.rulerUnits = originRulerUnits;
		app.preferences.typeUnits = originTypeUnits;
		app.preferences.displayDialogs = originDisplayDialogs;

		// end
		if (_config.ui.progress_ui) {
			_config.ui.progress_ui.palette_ui.close();
		}
		if (_config.ui.main_ui) {
			_config.ui.main_ui.active = true;
		}

	} catch(e) {
		alert("处理异常：" + e);
	}
}

function parse (_layers,_config) {
	if (_config && _layers && _layers.length > 0) {
		var targets = [];
		for (var i = 0; i < _layers.length; i++) {
			if (_config.cancel) {
				return;
			}
			_update_UI_progress(_config,PROCESS_MSG[1],i/_layers.length);
			gatherLayers(_layers[i],targets);
		}
		_update_UI_progress(_config,PROCESS_MSG[2],0);
		var nameGenerate = generateNameManager(targets.length);
		rename(_layers,_config,nameGenerate);
		_update_UI_progress(_config,PROCESS_MSG[2],1);
	}
}

function rename (_layers,_config,_nameGenerate,_pad) {
	if (_config && _layers && _nameGenerate && _layers.length > 0) {
		for (var i = 0; i < _layers.length; i++) {
			if (_config.cancel) {
				return;
			}
			var currentLayer = _layers[i];
			if (currentLayer) {
				if (currentLayer.typename == "LayerSet") {
					if (_config.ignoreHiddenLayer && !currentLayer.visible) {
						continue;
					}
					var groupPad = _nameGenerate.nextPad();
					rename(currentLayer.layers,_config,_nameGenerate,groupPad);
				}
				else if (currentLayer.typename == "ArtLayer") {
					if (_config.ignoreHiddenLayer && !currentLayer.visible) {
						continue;
					}
					var num = _nameGenerate.nextNumber();
					var newName = _config.serial;
					if (_pad) {
						newName = newName + _pad;
					}
					newName = newName + num;
					_update_UI_progress(_config,PROCESS_MSG[2] + currentLayer.name + " ----> " + newName,_nameGenerate.getPercent());
					currentLayer.name = newName;
				}
			}
		}
	}
}

function gatherLayers(_layerSetRef,layers){
	if (_layerSetRef) {
		_layerSetRef.name = _layerSetRef.name.replace(/^\s+|\s+$/g,"");
		if(_layerSetRef.typename == "ArtLayer"){
			layers.push(_layerSetRef);
		}
		else if (_layerSetRef.typename == "LayerSet") {
			for (var i = 0; i < _layerSetRef.layers.length; i++) {
				gatherLayers(_layerSetRef.layers[i],layers);
			}
		}
	}
}
