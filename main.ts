import { App, Modal, Notice, Plugin, PluginSettingTab, Setting,MarkdownView,normalizePath, TextComponent,ButtonComponent, TFile } from 'obsidian';
import { start } from 'repl';
import YAML from 'yaml'
// import CodeMirror from "codemirror";
interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	
	formatDate(date:Date):string{
		var getYear:string = date.getFullYear().toString();
        var getMonth:string = date.getMonth()+1 < 10 ? `0${date.getMonth()+1}`:`${date.getMonth()+1}`;	
        var getDate:string = date.getDate() < 10 ? `0${date.getDate()}`:`${date.getDate()}`
		var getHour:string = date.getHours()< 10 ? `0${date.getHours()}`:`${date.getHours()}`
		var getMinute:string = date.getMinutes()< 10 ? `0${date.getMinutes()}`:`${date.getMinutes()}`
		var getSecond:string = date.getSeconds()< 10 ? `0${date.getSeconds()}`:`${date.getSeconds()}`
		return  `${getYear}-${getMonth}-${getDate} ${getHour}:${getMinute}:${getSecond}`
	}
	
	generateUniqueBlockId(){
		return '^' + Math.random().toString(36).substr(2, 9);
	}
	
	getStartLineOfCurrentBlock(cm:CodeMirror.Editor):number{
		const cursorLine = cm.getCursor().line
		const lines = cm.getValue().split("\n")
		//get start of block
		var currentLine = cursorLine;
		var startLineOfCurrentBlock = currentLine;
		while(currentLine>=0){
			if(lines[currentLine] == '')
				break
			if(lines[currentLine] == '---')
				break
			if(lines[currentLine] == "```")
				break
			startLineOfCurrentBlock=currentLine;
			currentLine--;
		}
		return startLineOfCurrentBlock;
	}

	//this seems to be where the plugin started
	async onload() {
		console.log('loading plugin');
<<<<<<< HEAD
		this.addSettingTab(new SampleSettingTab(this.app, this));
=======
>>>>>>> c80840aba7983ccacf36b6810975d1d3666dcd72
		this.registerCodeMirror((cm: CodeMirror.Editor) => {
			cm.setOption("pollInterval",5000)
			cm.on("change",(cm,co)=>{
				console.log("change")
				const changeTime = this.formatDate(new Date())
				const startLineOfCurrentBlock = this.getStartLineOfCurrentBlock(cm);
				const data = cm.getValue()
				const lines = data.split("\n")
				if(lines[startLineOfCurrentBlock]){
					const leaf = this.app.workspace.activeLeaf;
					if(!leaf)
						return;
					const currentView = leaf.view as MarkdownView;
					const currentFile = currentView.file
					//get yaml as object
					var metadata = data.match(/(---)(.*)(---)/s);
					var yamlString = ""
					if(metadata){
						yamlString = metadata[0].match(/(?<=---\n)(.*)(?=\n---)/s)[0];
					}
					var yamlObject = YAML.parse(yamlString) 
					
					var newContent:string="";
					if(!lines[startLineOfCurrentBlock].startsWith("^")){
						var blockId = this.generateUniqueBlockId()
						//create a new key in yaml
						var noYaml=false
						var noBlockTimestamp=false
						if(yamlObject == undefined || yamlObject == null){
							yamlObject = new Object()
							noYaml=true;
						}
						if(yamlObject.blockTimestamp == undefined || 
							yamlObject.blockTimestamp == null){
							noBlockTimestamp=true
							yamlObject.blockTimestamp = new Array()
						}
						yamlObject.blockTimestamp.push({id:blockId,created:changeTime,modified:changeTime})
						for(var n = 0;n<lines.length;n++){
							if(n == startLineOfCurrentBlock){
								newContent+=blockId+"\n"
							}
							newContent+=lines[n]+"\n";
						}
						yamlString = YAML.stringify(yamlObject)//yamlString already include end newline
						if(!noYaml){
							//replace yaml front matter if it exist
							newContent = newContent.replace(/(?<=---\n)(.*)(?=---)/s,yamlString)
						}
						else{
							//prepend metadata to content
							newContent = "---\n"+yamlString+"---\n"+newContent
						}
						const cursorPos = cm.getCursor()
						this.app.vault.modify(currentFile,newContent).then(()=>{
							var addedNewContentLength = 4//1 for the new block id in the content, 3 for metadata timestamp in the yaml 
							if(noYaml){
								addedNewContentLength += 2 // for the closing and opening line of the metadata
							}
							if(noBlockTimestamp){
								addedNewContentLength +=1 //for the blocktimestamp key
							}
							cursorPos.line +=(addedNewContentLength) 
							cm.setCursor(cursorPos)
						})
					}else{
						if(yamlObject){
							if(yamlObject.blockTimestamp){
								yamlObject.blockTimestamp = yamlObject.blockTimestamp.map(b=>{
									if(b.id == lines[startLineOfCurrentBlock]){
										b.modified=changeTime
									}
									return b
								})
								yamlString = YAML.stringify(yamlObject)
								newContent = lines.join("\n")
								newContent = newContent.replace(/(?<=---\n)(.*)(?=---)/s,yamlString)
								this.app.vault.modify(currentFile,newContent)
							}
						}
					}
				}
			})
		})
	}

	onunload() {
		console.log('unloading plugin');
	}
}