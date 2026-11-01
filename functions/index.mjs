import {createApp} from '../server/app.mjs';
let app;
export default {fetch(request){app??=createApp();return app.fetch(request);}};
