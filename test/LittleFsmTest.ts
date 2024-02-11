import { LittleFsm, StateBoundary } from "../src/LittleFsm"

export type FetchingStatus = "fetching" | "success" | "error" 
export type SubmissionStatus = "submitting" | "success" | "error"

export class TripSearchContext {
    constructor(
       public readonly fetchingStatus: FetchingStatus,
       public readonly searchCriteria:string,
       public readonly results: any[],
       public readonly errorMessage: string | null) {
    }
}

export class SomeState {
    constructor() {}
}

export class SomeEvent {
    constructor() {}
}

export type RootBoundary = {
    states: {
        "home" : {message:string},
        "search": TripSearchContext,
        "seatplan": SomeState,
        "another": TripSearchContext
    },
    events: {
        "backtracked" : SomeEvent,
        "search_started" : {searchCriteria:string},
        "trip_selected": SomeEvent
    },
    compounds: {
        "search": {
            substates: {
                "search.loading" : {isEntry:true},
                "search.showing_results" : {},
                "search.showing_error" : {}
            },
            events: {
                "results-received" : {results:string[]},
                "error-occured" : {error:string},
            }
        },
        "seatplan": {
            substates: {
                "loading": {isEntry:true},
                "showing_seatplan" : {},
                "showing_error" : {}
            },
            events: {
                "seatplan-received" : {},
                "error-occured" : {},
            }
        }
    } 
}

export function buildMobileAppFsm(): LittleFsm<RootBoundary> {  
    let fsm = new LittleFsm<RootBoundary>();

    fsm.given("home")
        .when('backtracked', 'home', (context, event) => {return {message:"Hello"}})
        .when('search_started', 'search', (context, event) => new TripSearchContext("fetching", event.searchCriteria, [], ""));
    
    fsm.given("search")
        .when('backtracked', 'home', (context, event) => {return {message:"Hello"}})
        .when('trip_selected', 'seatplan', (context, event) => {return {}})
        
    fsm.givenSubstate("search", "search.loading")
        .when('results-received', 'search.showing_results', (c, e) => new TripSearchContext("fetching", c.searchCriteria, [], ""))
        .when('error-occured', 'search.showing_error', (c, e) => new TripSearchContext("fetching", c.searchCriteria, [], ""))

    fsm.givenSubstate("seatplan", "loading")
        .when('seatplan-received', 'showing_seatplan', (c, e) => new Object)
        .when('error-occured', 'showing_error', (c, e) => new Object)

    fsm.setEntryEffect('home', context => {
        
    })

    fsm.processSubstateEvent('search', 'results-received', {results:[]})

    return fsm;
}
