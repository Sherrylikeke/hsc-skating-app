// Keep the device matrix shared across navigation, event and calendar journeys.
export const phoneGroups={
  existing:['iPhone 17 Pro','Galaxy Z Flip 6','iPhone 17 Pro Max'],
  representative:['iPhone 16','iPhone SE (3rd gen)','Galaxy S24'],
};
export const browserGroup=process.env.HSC_BROWSER_GROUP;
if(browserGroup&&!Object.hasOwn(phoneGroups,browserGroup))throw new Error('HSC_BROWSER_GROUP must be existing or representative');
export function phoneModels(args=process.argv.slice(2)){
  return args.length?args:browserGroup?phoneGroups[browserGroup]:Object.values(phoneGroups).flat();
}
