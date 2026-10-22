import type {CapacitorConfig} from '@capacitor/cli';
const config:CapacitorConfig={
  appId:'ca.hsc.skating',
  appName:'HSC Skating',
  webDir:'dist',
  server:{androidScheme:'https',iosScheme:'capacitor',hostname:'localhost'},
  plugins:{CapacitorHttp:{enabled:false},LocalNotifications:{smallIcon:'ic_stat_hsc',iconColor:'#203b60'}},
};
export default config;
