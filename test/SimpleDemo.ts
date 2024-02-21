import { Fsm, SubFsm, StateManifest } from "../src/Fsm"
import { FsmBuilder, SubFsmBuilder } from "../src/FsmBuilder"

interface TripResult {
    tripId:string
}

export class TripSearchContext {
    constructor(
       public readonly searchCriteria:string,
       public readonly results: any[] | null,
       public readonly errorMessage?: string | null, 
       public readonly resultSelected?: TripResult | null) {
    }
    
    withResultSelected(tripResult:TripResult) {
        return new TripSearchContext(this.searchCriteria, this.results, this.errorMessage, tripResult)
    }
}

export class SeatSelectionContext {
    constructor(
        public readonly tripResult:TripResult,
        public readonly tripSearchContext:TripSearchContext
    ) {}
}

type TripSearchFsmSubScheme = {
    context:TripSearchContext,
    substates: ['showing_results', 'loading', 'showing_error', 'result_selection', 'back_navigation'],
    events: {
        "results_received" : {results:string[]},
        "error_occured" : {error:string},
        "retry": {},
        'searched': {},
        'result_selected': {},
        'backtracked': {}
    }
}

type SeatSelectionFsmSubScheme = {
    context: SeatSelectionContext,
    substates: ['showing_seatplan', 'requesting_seatplan', 'seat_reservation_creating', 'seat_reservation_confirmation', 'back_navigation'],
    events: {
        'seatplan_received': {seatPlan:string},
        'seat_reservation_requested': {},                
        'seat_reservation_confirmed': {},
        'backtracked': {},
        'refreshed': {}
    }
}

export type RootBoundary = {
    states: {
        "home" : {
            context:{message:string}
        },
        "search": TripSearchFsmSubScheme,
        "seat_selection" : SeatSelectionFsmSubScheme, 
        "traveller_info": {
            context: {}
        }
    },
    events: {
        "backtracked" : {},
        "search_started" : {searchCriteria:string},
        "trip_selected": {}
    }
}

// just simple identity function
const $I = (x) => x;

export function buildMobileAppFsm(): Fsm<RootBoundary> { 
    const fsm = rootFsmBuilderX();    
    
    fsm.setEntryEffect('home', context => {})

    fsm.init('home', {message:""})
    fsm.processEvent('search_started', {searchCriteria:""});
    
    let searchScopedFsm:SubFsm<RootBoundary['states']['search']> = fsm.subFsm('search');
    searchScopedFsm.processEvent('results_received', {results:[]})
    searchScopedFsm.processEvent('result_selected', {})
    
    let seatSelectionScopedFsm:SubFsm<SeatSelectionFsmSubScheme> = fsm.subFsm('seat_selection');
    seatSelectionScopedFsm.processEvent('seatplan_received', {seatPlan:""})
    seatSelectionScopedFsm.processEvent('backtracked', {})      
    
    return fsm;
}

function rootFsmBuilderX(): Fsm<RootBoundary> {
    let builder = new FsmBuilder<RootBoundary>();

    builder.atomicState("home")
        .transition('backtracked', 'home', (context, event) => {return {message:"Hello"}})
        .transition('search_started', 'search', (context, event) => new TripSearchContext(event.searchCriteria, null));
    
    builder.compoundState("search", tripSearchSubFsmBuilder())   
        .transitionOnCompletion('seat_selection', (tripSearchContext) => {
            return new SeatSelectionContext(tripSearchContext.resultSelected!, tripSearchContext);
        })
        .transitionOnTermination('home', (csc) => {
            return {message:""};
        })       
    
    builder.compoundState("seat_selection", seatSelectionSubFsmBuilder())  
        .transitionOnCompletion('traveller_info', (csc) => {
            return {tripId:1};
        })
        .transitionOnTermination('search', (csc) => csc.tripSearchContext)    

    return builder.build();
}

function tripSearchSubFsmBuilder() : SubFsmBuilder<TripSearchFsmSubScheme> {
    let subBuilder = new SubFsmBuilder<TripSearchFsmSubScheme>(); 

    subBuilder
        .entrySubstate("loading")
        .entrySubstate("showing_results", {description:"results_exits", satisfies:(c) => false})
        .completionSubstate('result_selection')
        .terminationSubstate('back_navigation')

    subBuilder.substate("loading")
        .transition('results_received', 'showing_results', $I)
        .transition('error_occured', 'showing_error', $I)
    
    subBuilder.substate('showing_results')
        .transition('searched', 'loading', $I)
        .transition('result_selected', 'result_selection', csc => csc.withResultSelected({tripId:"abcd"}))
        .transition('backtracked', 'back_navigation', $I)

    subBuilder.substate("showing_error")
        .transition('retry', 'loading', $I)
        .transition('backtracked', 'back_navigation', $I)

    return subBuilder;
}

function seatSelectionSubFsmBuilder() : SubFsmBuilder<SeatSelectionFsmSubScheme> {
    let subBuilder = new SubFsmBuilder<SeatSelectionFsmSubScheme>();

    subBuilder
        .entrySubstate('requesting_seatplan')
        .completionSubstate('seat_reservation_confirmation')
        .terminationSubstate('back_navigation')
   
    subBuilder.substate('requesting_seatplan')  
        .transition('seatplan_received', 'showing_seatplan', $I)

    subBuilder.substate('showing_seatplan')  
        .transition('refreshed', 'requesting_seatplan', $I)
        .transition('seat_reservation_requested', 'seat_reservation_creating', $I)   
        .transition('backtracked', 'back_navigation', $I)
        
    subBuilder.substate("seat_reservation_creating")  
        .transition('seat_reservation_confirmed', 'seat_reservation_confirmation', $I)   

    return subBuilder;
}
