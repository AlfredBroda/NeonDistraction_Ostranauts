//#target photoshop
//@target photoshop

// Photoshop Script to export assets for a portrait system for the Ostranauts game.
// Photoshop JS scripting reference: https://raw.githubusercontent.com/Adobe-CEP/CEP-Resources/master/Documentation/Product%20specific%20Documentation/Photoshop%20Scripting/photoshop-cc-javascript-ref-2019.pdf

// Constants
var E_SearchMode = {
    EXACT: "Exact",
    PREFIX: "Prefix",
};

var SETTINGS_FOLDER_NAME = "Settings";
var MODS_PREFIX = "ModsFolder: ";
var GAME_PREFIX = "GameFolder: ";


var LAYER_HIERARCHY_TO_GAME_FOLDER_MAP = {
    "doc/OriginalBodyAssets/HB/Icons": "Ostranauts_Data/StreamingAssets/images/paperdoll", // Key = Layer hierarchy
    "doc/OriginalBodyAssets/HB/BodyPart": "Ostranauts_Data/StreamingAssets/images/paperdoll", // Value = Game folder path
    "doc/OriginalBodyAssets/BodyBases": "Ostranauts_Data/StreamingAssets/images/paperdoll"
}

// Globals
var settings = {}; 

// Helpers
function searchContainingLayersForName(container, name, searchMode) {
    var result = [];

    for (var i = 0; i < container.layers.length; i++) {
        var layer = container.layers[i];
        if (searchMode === E_SearchMode.EXACT && layer.name === name) {
            result.push(layer);
        } else if (searchMode === E_SearchMode.PREFIX && layer.name.indexOf(name) === 0) {
            result.push(layer);
        }

        if (layer.typename === "LayerSet") {
            result = result.concat(searchContainingLayersForName(layer, name, searchMode));
        }
    }

    return result;
}

function getSettings(doc) {
    var result = {};
    var settingsLayer = searchContainingLayersForName(doc, SETTINGS_FOLDER_NAME, E_SearchMode.EXACT)[0];
    if (settingsLayer) {
        result = {
            modsFolder: new Folder(searchContainingLayersForName(settingsLayer, MODS_PREFIX, E_SearchMode.PREFIX)[0].name.replace(MODS_PREFIX, "")),
            gameFolder: new Folder(searchContainingLayersForName(settingsLayer, GAME_PREFIX, E_SearchMode.PREFIX)[0].name.replace(GAME_PREFIX, ""))
        };
    }
    return result;
}

// ExtendScript object property names are always strings, so Photoshop Layer
// objects need an identity-based map rather than a plain object.
function LayerMap() {
    this.layers = [];
    this.values = [];
}

LayerMap.prototype.indexOf = function(layer) {
    for (var i = 0; i < this.layers.length; i++) {
        if (this.layers[i] === layer) {
            return i;
        }
    }
    return -1;
};

LayerMap.prototype.put = function(layer, value) {
    var index = this.indexOf(layer);
    if (index === -1) {
        this.layers.push(layer);
        this.values.push(value);
    } else {
        this.values[index] = value;
    }
};

LayerMap.prototype.get = function(layer) {
    var index = this.indexOf(layer);
    return index === -1 ? null : this.values[index];
};

function getDirectChildLayerByName(container, name) {
    for (var i = 0; i < container.layers.length; i++) {
        if (container.layers[i].name === name) {
            return container.layers[i];
        }
    }
    return null;
}

// Resolves a map key such as "doc/OriginalBodyAssets/HB/BodyPart" by
// following direct child layers from the active document.
function getLayerGroupByHierarchy(doc, key) {
    var pathParts = key.split("/");
    var currentContainer = doc;

    if (pathParts.length === 0 || pathParts[0] !== "doc") {
        return null;
    }

    for (var i = 1; i < pathParts.length; i++) {
        currentContainer = getDirectChildLayerByName(currentContainer, pathParts[i]);
        if (!currentContainer || currentContainer.typename !== "LayerSet") {
            return null;
        }
    }

    return currentContainer;
}

function getListOfLayersUnderTargetLayerGroup(doc, key) {
    var targetLayerGroup = getLayerGroupByHierarchy(doc, key);
    if (targetLayerGroup) {
        var layers = [];
        for (var i = 0; i < targetLayerGroup.layers.length; i++) {
            layers.push(targetLayerGroup.layers[i]);
        }
        return layers;
    } else {
        return [];
    }
}

// Returns a single File object representing the path to the target layer's corresponding game asset
function constructRelinkPathFromLayerName(doc, dict, key, targetName) {
    // dict = LAYER_HIERARCHY_TO_GAME_FOLDER_MAP
    // example: key = "doc/Originals/HB/BodyPart" will get the names of the layers under BodyPart layer group, for example "HBlegUpperL", and append it to the dict value to get "Ostranauts_Data/StreamingAssets/images/paperdoll/HBlegUpperL.png"
    
    var targetLayerGroup = getLayerGroupByHierarchy(doc, key);
    if (targetLayerGroup) {
        var layerName = targetName;
        var gameFolderPath = dict[key];
        return new File(settings.gameFolder.fullName + "/" + gameFolderPath + "/" + layerName + ".png");
    } else {
        return null;
    }
} // Used by mapLayerToRelinkPath AVOID using directly

// Returns a mapping of Layer objects to their corresponding relink paths (File objects)
function mapLayerToRelinkPath(doc, layers, dict, key) {
    var mapping = new LayerMap();
    for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        var relinkPath = constructRelinkPathFromLayerName(doc, dict, key, layer.name);
        mapping.put(layer, relinkPath);
    }
    return mapping; // Layer:RelinkPath mapping object
}


// ActionReference and ActionDescriptor Helpers
function activateLayerAndGetID(doc, layer) {
        var id = null;

        doc.activeLayer = layer;
        var ref = new ActionReference();
        ref.putIdentifier(charIDToTypeID("Lyr "), layer.id);
        var desc = executeActionGet(ref);
        id = desc.getInteger(stringIDToTypeID("layerID"));

        return id;
} // Used by mapLayerToID AVOID using directly

// function getAllLayerIDsThroughListOfLayers(listOfLayers) { // Replace this with mapLayerToID
//     var ids = [];
//     for (var i = 0; i < listOfLayers.length; i++) {
//         var layer = listOfLayers[i];
//         var id = activateLayerAndGetID(app.activeDocument, layer);
//         ids.push(id);
//     }
//     return ids;
// }

function mapLayerToID(listOfLayers) {
    var mapping = new LayerMap();
    for (var i = 0; i < listOfLayers.length; i++) {
        var layer = listOfLayers[i];
        var id = activateLayerAndGetID(app.activeDocument, layer);
        mapping.put(layer, id);
    }
    return mapping; // Layer:ID mapping object
}

function mergeLayerIDAndRelinkPathMappings(layerIDMapping, layerRelinkPathMapping) {
    var mergedMapping = {};
    for (var i = 0; i < layerRelinkPathMapping.layers.length; i++) {
        var layer = layerRelinkPathMapping.layers[i];
        var relinkPath = layerRelinkPathMapping.values[i];
        var id = layerIDMapping.get(layer);
        mergedMapping[id] = relinkPath;
    }
    return mergedMapping;
} // ID:RelinkPath mapping object

// !! These two functions will select the layer and relink it and this must be done sequentially =======
// via another function that loops through the list of layers and calls these two functions in order. ==
// Otherwise, the relink will not work because the layer must be selected first.                      ==
function selectById(id) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putIdentifier(charIDToTypeID('Lyr '), id);
        desc.putReference(charIDToTypeID('null'), ref);
        executeAction(charIDToTypeID('slct'), desc, DialogModes.NO);
} 
  
function relinkCurrentlyActiveSmartObject(path) {
    var desc = new ActionDescriptor();
    desc.putPath( charIDToTypeID('null'), new File( path ) );
    executeAction( stringIDToTypeID('placedLayerRelinkToFile'), desc, DialogModes.NO );
}
// !! ==================================================================================================

/*
PSEUDO CODE

1. listOfLayers = getListOfLayersUnderTargetLayerGroup

2. Dict(Layer:RelinkPath) = mapLayerToRelinkPath

3. Dict(Layer:ID) = mapLayerToID

4. Dict(ID:RelinkPath) = mergeLayerIDAndRelinkPathMappings

5. Iterate through Dict(ID:RelinkPath), for each:
    a. selectById(id)
    b. relinkCurrentlyActiveSmartObject(path)

*/

function relinkLayersByIDToRelinkPath(doc, idRelinkPathMapping, progress, key) {
    for (var id in idRelinkPathMapping) {
        var relinkPath = idRelinkPathMapping[id];
        progress.status.text = "Relinking " + key + " (" + (progress.completed + 1) + " of " + progress.total + ")";
        progress.window.update();
        selectById(id);
        relinkCurrentlyActiveSmartObject(relinkPath);
        progress.completed++;
        progress.bar.value = progress.completed;
        progress.window.update();
    }
}


// DEBUG Helpers
function stringifyLayerRelinkPathMapping(mapping) {
    var result = "";
    for (var i = 0; i < mapping.layers.length; i++) {
        result += mapping.layers[i].name + " => " + mapping.values[i].fsName + "\n";
    }
    return result;
}

function stringifyListOfLayerNames(layers) {
    var result = "";
    for (var i = 0; i < layers.length; i++) {
        result += layers[i].name + "\n";
    }
    return result;
}

function stringifyLayerToIDMapping(mapping) {
    var result = "";
    for (var i = 0; i < mapping.layers.length; i++) {
        result += mapping.layers[i].name + " => " + mapping.values[i] + "\n";
    }
    return result;
}

function stringifyIDToRelinkPathMapping(mapping) {
    var result = "";
    for (var id in mapping) {
        result += id + " => " + mapping[id].fsName + "\n";
    }
    return result;
}

function debugInfo(message) {
    var t = "Debug Info: ";
    var e = false;

    alert(message, t, e);
}

// GUI

function createProgressWindow(total) {
    var window = new Window("palette", "Relinking Portrait Assets (This takes a while and may appear to freeze.)");
    var status = window.add("statictext", undefined, "Preparing relink operations...");
    var bar = window.add("progressbar", undefined, 0, total);

    status.preferredSize.width = 430;
    bar.preferredSize.width = 430;
    window.show();

    return {
        window: window,
        status: status,
        bar: bar,
        completed: 0,
        total: total
    };
}

// Main

function relinkLayersByKey(doc, key, progress) {

        // ****** TEST getListOfLayersUnderTargetLayerGroup ****************************************************************************************** TEST **********
    var listOfLayers = getListOfLayersUnderTargetLayerGroup(doc, key);
    progress.status.text = "Preparing " + key;
    progress.window.update();
    // debugInfo("Layers under '" + key + "': " + stringifyListOfLayerNames(layersUnderBodyPart));

    // ****** TEST mapLayerToRelinkPath ********************************************************************************************************** TEST *********
    var layerRelinkPathMapping = mapLayerToRelinkPath(doc, listOfLayers, LAYER_HIERARCHY_TO_GAME_FOLDER_MAP, key);
    // debugInfo("layerRelinkPathMapping: " + stringifyLayerRelinkPathMapping(layerRelinkPathMapping));

    // ****** TEST mapLayerToID ***************************************************************************************************************** TEST *********
    var layerIDMapping = mapLayerToID(listOfLayers);
    // debugInfo("layerIDMapping: " + stringifyLayerToIDMapping(layerIDMapping));

    // ****** TEST mergeLayerIDAndRelinkPathMappings ******************************************************************************************** TEST *********
    var idRelinkPathMapping = mergeLayerIDAndRelinkPathMappings(layerIDMapping, layerRelinkPathMapping);
    // debugInfo("idRelinkPathMapping: " + stringifyIDToRelinkPathMapping(idRelinkPathMapping));

    // ****** TEST relinkLayersByIDToRelinkPath ************************************************************************************************** TEST *********
    relinkLayersByIDToRelinkPath(doc, idRelinkPathMapping, progress, key);
    
}

function main() {
    var doc = app.activeDocument;
    var total = 0;
    var progress;

    settings = getSettings(doc);
    // debugInfo("Settings retrieved:\nMods Folder: " + settings.modsFolder.fsName + "\nGame Folder: " + settings.gameFolder.fsName);

    for (var key in LAYER_HIERARCHY_TO_GAME_FOLDER_MAP) {
        total += getListOfLayersUnderTargetLayerGroup(doc, key).length;
    }

    progress = createProgressWindow(total);
    for (var relinkKey in LAYER_HIERARCHY_TO_GAME_FOLDER_MAP) {
        relinkLayersByKey(doc, relinkKey, progress);
    }

    progress.status.text = "Relinking complete (" + progress.completed + " of " + progress.total + ")";
    progress.window.update();
}
 
main();
