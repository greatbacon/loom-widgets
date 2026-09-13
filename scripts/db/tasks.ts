import { destroy } from "./destroy";
import { migrate } from "./migrate";
// import { seedDB } from "./seed";
// import { create } from "./create";
// import { testMigration } from "./testMigration"


const task = process.argv[2];

switch(task){
    case 'destroy':
        console.log("destroy selected");
        await destroy();
        break;
    case 'migrate':
        console.log("migrate selected");
        await migrate();
        break;
    // case 'testMigrate':
    //     console.log("test migration selected");
    //     await testMigration();
    //     break;
    // case 'seed':
    //     console.log("seed selected");
    //     await seedDB();
    //     break;
    // case 'create':
    //     console.log("create selected")
    //     await create();
    //     break;    
    default:
        console.log("task not selected");
        console.log(task);
}