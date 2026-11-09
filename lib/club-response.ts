import type {ClubEvent,LiveEvent,OfficialDocument,SyncStatus} from './club-types';

function documentNeedsReview(document:OfficialDocument):boolean{
  return !!document.error||!!document.entryFiles?.some(file=>!file.checkedAt||documentNeedsReview(file));
}

export function clubEventResponse(event:LiveEvent,admin:boolean):ClubEvent{
  const needsReview=!!event.detailError||event.documents.some(documentNeedsReview);
  if(admin)return {...event,needsReview};
  return {
    id:event.id,name:event.name,url:event.url,start:event.start,end:event.end,timezone:event.timezone,
    venue:event.venue,city:event.city,updateText:event.updateText,source:event.source,needsReview,
    documents:event.documents.map(document=>({url:document.url,label:document.label,kind:document.kind,category:document.category})),
    participants:event.participants.map(participant=>({id:participant.id,name:participant.name,category:participant.category,club:participant.club,section:participant.section,skaterIds:participant.skaterIds,matchStatus:participant.matchStatus,sourceUrl:participant.sourceUrl})),
    blocks:event.blocks.map(block=>({id:block.id,date:block.date,start:block.start,end:block.end,rink:block.rink,category:block.category,categoryKey:block.categoryKey,group:block.group,range:block.range,breaks:block.breaks?.map(({start,end})=>({start,end})),activity:block.activity,page:block.page,sourceUrl:block.sourceUrl})),
    startingOrders:event.startingOrders?.map(order=>({id:order.id,name:order.name,category:order.category,program:order.program,startNumber:order.startNumber,warmupGroup:order.warmupGroup,warmupSeconds:order.warmupSeconds,individualTime:order.individualTime,sourceUrl:order.sourceUrl,page:order.page,skaterIds:order.skaterIds})),
  };
}

export function clubSyncResponse(sync:SyncStatus,admin:boolean):SyncStatus{
  const needsReview=!!sync.error;
  return admin?{...sync,needsReview}:{needsReview};
}
