//import { buildMobileAppFsm } from "./statecharts/MiniAppFsm";

import { Fsm, } from "../src/Fsm";
import { buildFsmExporter, CompoundStateUMLNode, StateTransitionDescriptor } from "../src/FsmExporter";
import { buildMobileAppFsm, RootBoundary } from "./SimpleDemo";

document.addEventListener('DOMContentLoaded', function(){ 
    
    const searchParams = new URLSearchParams(window.location.search);

    let showingRootScope = searchParams.has("scope") == false || searchParams.get("scope") == 'root';
    let scope:string|null = (showingRootScope == false)? searchParams.get("scope") : null;
    let depth:number = searchParams.get("depth") == "0"? 0 : 1;

    //const params: URLSearchParams = url.searchParams;
    console.log("URL search params: ", searchParams);
    // get target key/value from URLSearchParams object
    //const : string = params.get('yourParamKey');

    let fsm:Fsm<RootBoundary> = buildMobileAppFsm();
    let exporter = buildFsmExporter(fsm);

    let descriptorRoot:{
        transitionDescriptors:StateTransitionDescriptor[]
        compoundStates: CompoundStateUMLNode[]
    } = exporter.getEventStateRules();
    
    
    let diagramScriptBody = '';
    if(showingRootScope) {
        diagramScriptBody = generateRootLevelDiagramScripts(descriptorRoot, depth);
    } else {
        let compoundStateToShow = descriptorRoot.compoundStates.find(c => c.stateName == scope);
        if(compoundStateToShow) {
            diagramScriptBody = generateCompoundStateLevelDiagramScripts(compoundStateToShow);
        } else {
            diagramScriptBody = "Error"
        }
    }

    let diagramContent = `
                        <pre class='mermaid'>
                        %%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#d7e4e7', 'primaryTextColor': '#000', 'primaryBorderColor': '#96bac4', 'tertiaryColor': '#00ff00ff', 'secondaryTextColor': '#f0f', 'lineColor':'#060c6a' }}}%%
                        stateDiagram-v2
                        direction TB                        
                        ${diagramScriptBody}                        
                        </pre>
                        `;

    let diagramContainer = document.getElementById("state-diagram-display-container");
    if(diagramContainer) {        
        diagramContainer.innerHTML = diagramContent;        
    }
})

function generateRootLevelDiagramScripts(descriptorRoot:{
    transitionDescriptors:StateTransitionDescriptor[]
    compoundStates: CompoundStateUMLNode[]}, depth:number): string{

    let diagramNodes = `[*] --> ${descriptorRoot.transitionDescriptors[0].currState} \n`;  

    descriptorRoot.transitionDescriptors.forEach(stateEvent => {
        diagramNodes+= stateEvent.currState+  " --> "+  stateEvent.nextState+  ": "+  stateEvent.event + "\n";
    }) 

    
    descriptorRoot.compoundStates.forEach(compoundState => {        
        if(depth > 0) {
            diagramNodes += generateCompoundStateLevelDiagramScripts(compoundState);
        } else {
            diagramNodes+= `state ${compoundState.stateName} {`
            diagramNodes+= `[*] --> [*]` + "\n"
            diagramNodes+= `}`
        }
    })
    

    return diagramNodes;
}

function generateCompoundStateLevelDiagramScripts(compoundState: CompoundStateUMLNode): string{
    console.log(compoundState.stateName, compoundState);

    let diagramNodes = "";

    diagramNodes+= `state ${compoundState.stateName} {`
        //diagramNodes+= `[*] --> ${compoundState.transitionDescriptors[0].currState}`
        //diagramNodes+= '\tdirection TB'

        if(compoundState.initialSubStates.length == 1) {
            diagramNodes+= `[*] --> ${compoundState.initialSubStates[0].name}` + "\n"
        } else {
            //diagramNodes += "state if_state <<choice>>"  + "\n";
            //diagramNodes += `[*] --> if_state` + "\n";

            compoundState.initialSubStates.forEach(initialSubState => {
                if(initialSubState.condition) {
                    diagramNodes += `[*] --> ${initialSubState.name} : if( ${initialSubState.condition.description} )` + "\n"
                } else {
                    diagramNodes += `[*] --> ${initialSubState.name}` + "\n"
                }
            })
        }

        compoundState.transitionDescriptors.forEach(stateEvent => {
            diagramNodes+= "\t" + `${stateEvent.currState}` +  " --> "+  `${stateEvent.nextState}` +  ": "+  stateEvent.event + "\n";
        }) 

        compoundState.completionSubStates?.forEach(initialSubState => {
            diagramNodes+= `${initialSubState} --> [*] : @completed` + "\n"
        })

        compoundState.terminationSubStates?.forEach(initialSubState => {
            diagramNodes+= `${initialSubState} --> [*] : @terminated` + "\n"
        })

        diagramNodes+= `}`

    return diagramNodes;
}