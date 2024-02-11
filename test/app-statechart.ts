//import { buildMobileAppFsm } from "./statecharts/MiniAppFsm";

import { LittleFsm, StateTransitionDescriptor } from "../src/LittleFsm";
import { buildMobileAppFsm, RootBoundary } from "./LittleFsmTest";

document.addEventListener('DOMContentLoaded', function(){ 
    let fsm:LittleFsm<RootBoundary> = buildMobileAppFsm();

    let descriptorRoot:{
        transitionDescriptors:StateTransitionDescriptor[]
        compoundStates: {stateName:string, transitionDescriptors:StateTransitionDescriptor[]}[]
    } = fsm.getEventStateRules();
    
    let diagramScriptContent = generateDiagramContent(descriptorRoot);

    let diagramContainer = document.getElementById("state-diagram-display-container");
    if(diagramContainer) {        
        diagramContainer.innerHTML = diagramScriptContent;        
    }
})

function generateDiagramContent(descriptorRoot:{
    transitionDescriptors:StateTransitionDescriptor[]
    compoundStates: {stateName:string, transitionDescriptors:StateTransitionDescriptor[]}[]}): string{

    let diagramNodes = "";  

    descriptorRoot.transitionDescriptors.forEach(stateEvent => {
        diagramNodes+= stateEvent.currState+  " --> "+  stateEvent.nextState+  ": "+  stateEvent.event + "\n";
    }) 

    descriptorRoot.compoundStates.forEach(compoundState => {
        diagramNodes+= `state ${compoundState.stateName} {`
        diagramNodes+= `[*] --> ${compoundState.transitionDescriptors[0].currState}`
        //diagramNodes+= '\tdirection TB'

        compoundState.transitionDescriptors.forEach(stateEvent => {
            diagramNodes+= "\t" + stateEvent.currState+  " --> "+  stateEvent.nextState+  ": "+  stateEvent.event + "\n";
        }) 

        diagramNodes+= `}`
    })

    let diagramContent = `
                        <pre class='mermaid'>
                        %%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#d7e4e7', 'primaryTextColor': '#000', 'primaryBorderColor': '#96bac4', 'tertiaryColor': '#00ff00ff', 'secondaryTextColor': '#f0f', 'lineColor':'#060c6a' }}}%%
                        stateDiagram-v2
                        direction LR
                        [*] --> ${descriptorRoot.transitionDescriptors[0].currState}
                        ${diagramNodes}                        
                        </pre>
                        `;

    return diagramContent;
}