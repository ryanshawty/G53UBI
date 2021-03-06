var serialport = require('serialport');
var SerialPort = serialport.SerialPort;
var mongoose = require('mongoose');

mongoose.connect('whoisin:94jefgadkgf29@178.62.14.38:27017/whoisin');

var UserSchema = mongoose.Schema({
	name: String,
	nfcId: Number,
	status: Number
});
var UserModel = mongoose.model('Users', UserSchema);

var sp;
var path;
serialport.list(function(err, ports){
	ports.forEach(function(port){
		path = port.comName;
	});
	sp = new SerialPort(path, {
		parser: serialport.parsers.readline('\n'),
		baudrate: 115200
	});

	sp.on('open', function(){
		console.log('Serial port to Arduino opened');
		process.on('exit', function(){
			sp.write('busy');
			sp.flush();
		});
		sp.on('data', function(data){
			module.exports.dataProcess(data, sp);
		});
	});
});

module.exports.dataProcess = function (data, sp, cb){
	if(data.indexOf('Hello!') !== -1)
		sp.write('ready');
	if(data.indexOf('UID Value: ') === 0){
		var id = data.substring(12);
		console.log(id);
		var bytes = id.split(' ');
		var buf = new Buffer(bytes.length);
		for(var i = 0; i < bytes.length; i++){
			var byte = bytes[i].substring(2);
			buf.write(byte, i);
		}
		var id = buf.readInt32LE(0);
		if(addingUser){
			sp.write('busy');
			UserModel.create({
				name: user,
				nfcId: id,
				status: 1
			}, function(err){
				if(err){
					console.log('Error adding user...', err);
				}else{
					console.log('Added ', user);
				}
				setTimeout(function(){
					sp.write('ready');
					if(cb) cb();
				},500);
			});
			addingUser = false;
		}else{
			UserModel.findOne({nfcId: id}, function(err, user){
				if(!user){
					console.log('Could not find user');
				}else{
					sp.write('busy');
					if(user.status === 1){
						user.status = 0;
					}else{
						user.status = 1;
					}
					user.save(function(err){
						if(err){
							console.log('Could not update user', err);
						}else{
							console.log('User \''+user.name+'\' status is now: ', user.status);
						}
					});
				}
				setTimeout(function(){
					sp.write('ready');
					if(cb) cb();
				},500);
			});
		}
	}
	
	console.log('data received: ', data.toString());
}

var sys = require('sys');
var addingUser = false;
var user;

var stdin = process.openStdin();
stdin.addListener('data', function(data){
	var command = data.toString();
	if(command.indexOf('adduser') === 0){
		user = command.substring(command.indexOf(' ') + 1).trim();
		console.log('Scan card now.');
		addingUser = true;
	}
});

