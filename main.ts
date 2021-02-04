import { CONNREFUSED } from 'dns';
import {Plugin,MarkdownView, TFile} from 'obsidian';
import { start } from 'repl';
import YAML from 'yaml'

export default class MyPlugin extends Plugin {

	globalTimeOut:any=null
	modifiedThroughPlugin=false
	
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
			if(lines[currentLine] == '' && currentLine != cursorLine)
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

	createNewBlock(yamlObject:any,changeTime:string,lines:string[],startLineOfCurrentBlock:number,cm:CodeMirror.Editor,currentFile:TFile){
		console.log("create new block")
		var blockId = this.generateUniqueBlockId()
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
		var newContent=""
		for(var n = 0;n<lines.length;n++){
			if(n == startLineOfCurrentBlock){
				newContent+=blockId+"\n"
			}
			newContent+=lines[n]+"\n";
		}
		var yamlString = YAML.stringify(yamlObject)//yamlString already include end newline
		if(!noYaml){
			//replace yaml front matter if it exist
			newContent = newContent.replace(/(?<=---\n)(.*)(?=---)/s,yamlString)
		}
		else{
			//prepend metadata to content
			newContent = "---\n"+yamlString+"---\n"+newContent
		}
		this.modifiedThroughPlugin=true
		const cursorPos = cm.getCursor() 
		this.app.vault.modify(currentFile,newContent).then(()=>{
			//update cursor position
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
	}

	updateBlock(yamlObject:any,changeTime:string,startLineOfCurrentBlock:number,lines:string[],currentFile:TFile){
		if(yamlObject){
			if(yamlObject.blockTimestamp){
				console.log("update a block")
				yamlObject.blockTimestamp = yamlObject.blockTimestamp.map((b:any)=>{
					if(b.id == lines[startLineOfCurrentBlock]){
						b.modified=changeTime
					}
					return b
				})
				var yamlString = YAML.stringify(yamlObject)
				var newContent = lines.join("\n")
				newContent = newContent.replace(/(?<=---\n)(.*)(?=---)/s,yamlString)
				this.modifiedThroughPlugin=true
				this.app.vault.modify(currentFile,newContent).then(()=>{
				}) 
			}
		}
	}

	removeBlock(startLineOfCurrentBlock:number,lines:string[],yamlObject:any,currentFile:TFile,cm:CodeMirror.Editor,id:string){
		if(yamlObject){
			if(yamlObject.blockTimestamp){
				console.log("remove a block")
				yamlObject.blockTimestamp = yamlObject.blockTimestamp.filter((b:any)=>{
					if(b.id != id)
						return b;
				})
				//update the new content to  not include the current block id
				var newContent=""
				for(var n = 0;n<lines.length;n++){
					if(n != startLineOfCurrentBlock){
						newContent+=lines[n]+"\n";	
					}
				}
				//update the metadata
				var yamlString = YAML.stringify(yamlObject)
				newContent = newContent.replace(/(?<=---\n)(.*)(?=---)/s,yamlString)
				//update cursor position
				const position = cm.getCursor()
				position.line -=4
				this.modifiedThroughPlugin=true
				this.app.vault.modify(currentFile,newContent).then(()=>{
					cm.setCursor(position.line) 
				})
			}
		}
	}

	//this seems to be where the plugin started
	async onload() {
		console.log('loading plugin');
		this.registerCodeMirror((cm: CodeMirror.Editor) => {
			cm.on("change",(cm,co)=>{

				if(this.modifiedThroughPlugin){
					this.modifiedThroughPlugin=false;
					return;
				}

				const changeTime = this.formatDate(new Date())
				const startLineOfCurrentBlock = this.getStartLineOfCurrentBlock(cm);
				const data = cm.getValue()
				const lines = data.split("\n")
				//get yaml as object
				const leaf = this.app.workspace.activeLeaf;
				if(!leaf)
					return;
				const currentView = leaf.view as MarkdownView;
				const currentFile = currentView.file
				var metadata = data.match(/(---)(.*)(---)/s);
				var yamlString = ""
				if(metadata){
					yamlString = metadata[0].match(/(?<=---\n)(.*)(?=\n---)/s)[0];
				}
				var yamlObject = YAML.parse(yamlString)

				if(startLineOfCurrentBlock == 0 && lines[startLineOfCurrentBlock].startsWith("---")){
					//cursor is in the metadata
					return;
				}

				//user removed a block
				if(lines[co.from.line] == ''){
					// this.removeBlock(co,startLineOfCurrentBlock,lines,yamlObject,currentFile,cm)
					var removed = co.removed.filter(c=>{
						if(c.startsWith("^")){
							return c
						}
					})
					var id:string
					if(removed.length>0){
						id = removed[0]
						if(this.globalTimeOut !=null) clearTimeout(this.globalTimeOut)
						this.globalTimeOut = setTimeout(()=>this.removeBlock(startLineOfCurrentBlock,lines,yamlObject,currentFile,cm,id),500)
						return;
					}else if(startLineOfCurrentBlock == co.from.line-1){
						id = lines[startLineOfCurrentBlock]
						if(this.globalTimeOut !=null) clearTimeout(this.globalTimeOut)
						this.globalTimeOut = setTimeout(()=>this.removeBlock(startLineOfCurrentBlock,lines,yamlObject,currentFile,cm,id),500)
						return;
					}
				}

				//user update or create new block
				if(lines[startLineOfCurrentBlock]){
					if(!lines[startLineOfCurrentBlock].startsWith("^")){
						if(this.globalTimeOut !=null) clearTimeout(this.globalTimeOut)
						this.globalTimeOut = setTimeout(()=>this.createNewBlock(yamlObject,changeTime,lines,startLineOfCurrentBlock,cm,currentFile),500)
					}else{
						if(this.globalTimeOut !=null) clearTimeout(this.globalTimeOut)
						this.globalTimeOut = setTimeout(()=>this.updateBlock(yamlObject,changeTime,startLineOfCurrentBlock,lines,currentFile),500)
					}
				}
			})
		})
	}

	onunload() {
		console.log('unloading plugin');
	}
}