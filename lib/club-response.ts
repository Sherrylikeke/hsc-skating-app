import type {ClubEvent,LiveEvent,OfficialDocument,SyncStatus} from './club-types';
import {ENTRY_PDF_VERSION,STARTING_DRAW_VERSION} from './club-types';

function documentNeedsReview(document:OfficialDocument):boolean{
  return !!document.error||(document.kind==='start-order'&&(!document.checkedAt||![STARTING_DRAW_VERSION,'starting-api-1'].includes(document.parserVersion||'')))||!!document.entryFiles?.some(file=>!file.checkedAt||file.parserVersion!==ENTRY_PDF_VERSION||file.matchingRosterHash!==document.matchingRosterHash||documentNeedsReview(file));
}

export const eventNeedsReview=(event:LiveEvent)=>!!event.detailError||event.documents.some(documentNeedsReview);

export function clubEventResponse(event:LiveEvent,admin:boolean):ClubEvent{
  const needsReview=eventNeedsReview(event);
  const sourceStatus={lastSuccess:event.detailSuccessAt||(!needsReview?event.detailCheckedAt:undefined),lastAttempt:event.detailCheckedAt,needsReview,retainedSchedule:!!event.scheduleRetained};
  if(admin)return {...event,needsReview,sourceStatus};
  return {
    id:event.id,name:event.name,url:event.url,start:event.start,end:event.end,timezone:event.timezone,
    venue:event.venue,city:event.city,updateText:event.updateText,source:event.source,needsReview,sourceStatus,registrations:event.registrations,offeredCategories:event.offeredCategories,
    documents:event.documents.map(document=>({url:document.url,label:document.label,kind:document.kind,category:document.category})),
    participants:event.participants.map(participant=>({id:participant.id,name:participant.name,category:participant.category,club:participant.club,section:participant.section,skaterIds:participant.skaterIds,matchStatus:participant.matchStatus,sourceUrl:participant.sourceUrl})),
    blocks:event.blocks.map(block=>({id:block.id,date:block.date,start:block.start,end:block.end,rink:block.rink,category:block.category,categoryKey:block.categoryKey,group:block.group,range:block.range,breaks:block.breaks?.map(({start,end})=>({start,end})),activity:block.activity,page:block.page,sourceUrl:block.sourceUrl})),
    startingOrders:event.startingOrders?.map(order=>({id:order.id,name:order.name,category:order.category,program:order.program,startNumber:order.startNumber,warmupGroup:order.warmupGroup,warmupSeconds:order.warmupSeconds,drawComplete:order.drawComplete,withdrawnCount:order.withdrawnCount,individualTime:order.individualTime,sourceUrl:order.sourceUrl,page:order.page,skaterIds:order.skaterIds})),
  };
}

export function clubSyncResponse(sync:SyncStatus,admin:boolean):SyncStatus{
  const needsReview=!!sync.error;
  const sourceStatus={lastSuccess:sync.lastCalendarSuccess,lastAttempt:sync.lastAttempt,needsReview};
  return admin?{...sync,needsReview,sourceStatus}:{needsReview,sourceStatus};
}
