/***********************************************************
* Developer: Minhas Kamal (minhaskamal024@gmail.com)       *
* Website: https://github.com/MinhasKamal/DownGit          *
* License: MIT License                                     *
***********************************************************/

'use strict';

var homeModule = angular.module('homeModule', [
	'ngRoute',
]);

homeModule.config([
	'$routeProvider',

	function ($routeProvider) {
		$routeProvider
			.when('/home', {
                templateUrl: 'app/home/home.html',
                controller: [
				'$scope',
				'$routeParams',
				'$location',
				'toastr',
				'homeService',

				function($scope, $routeParams, $location, toastr, homeService){
					$scope.downUrl="";
					$scope.filename="";
					$scope.repo="";
					$scope.paths="";
					$scope.pathArray=[];
					$scope.subfolder="";
					$scope.isProcessing={val: false};
					$scope.downloadedFiles={val: 0};
					$scope.totalFiles={val: 0};

					var templateUrl = "github.com";
					var downloadUrlPrefix = "https://jackceparou.github.io/DownGit/#/home?";

					if($routeParams.filename){
						$scope.filename=$routeParams.filename;
					}
					if($routeParams.subfolder){
						$scope.subfolder=$routeParams.subfolder;
					}
					if($routeParams.repo){
						$scope.repo=$routeParams.repo;
					}
					if($routeParams.paths){
						$scope.paths=$routeParams.paths;
						$scope.pathArray = $scope.paths.replace('\n', '|').replace('\r', '|').replace('||', '|').split('|');
					}
					var options = {
						fileName: $scope.filename,
						subFolder: $scope.subfolder,
					};
					/**/
					if($scope.repo.match(templateUrl)){
						var progress = {
							isProcessing: $scope.isProcessing,
							downloadedFiles: $scope.downloadedFiles,
							totalFiles: $scope.totalFiles
						};

						//ga('send', 'event', 'download', elEv.action.toLowerCase(), $scope.paths, 1);
						ga('send', {
							hitType: 'event',
							eventCategory: 'download',
							eventAction: "repo="+$scope.repo.replace("https://github.com/", "")+"&paths="+$scope.paths+"&filename="+$scope.filename+"&subfolder="+$scope.subfolder,
							eventLabel: paths
						});
						homeService.downloadZippedFiles($scope.repo, $scope.pathArray, progress, options);
					}
					else if($scope.url!=""){
						toastr.warning("Invalid URL",{iconClass: 'toast-down'});
					}/**/

					$scope.createDownLink = function(){
						$scope.downUrl="";

						if(!$scope.repo){
							return;
						}

						if($scope.repo.match(templateUrl)){
							$scope.pathArray = $scope.paths.replace('\n', '|').replace('\r', '|').replace('||', '|').split('|');
							$scope.downUrl = downloadUrlPrefix + "repo=" + $scope.repo + '&paths=' + $scope.pathArray.join('|');
							if($scope.filename)
								$scope.downUrl += "&filename=" + $scope.filename;
							if($scope.subfolder)
								$scope.downUrl += "&subfolder=" + $scope.subfolder;
						}else if($scope.url!=""){
							toastr.warning("Invalid URL",{iconClass: 'toast-down'});
						}
					};


				}],
            });
    }
]);

homeModule.factory('homeService', [
	'$http',
	'$q',

    function ($http, $q) {
		var urlPrefix = "";
		var urlPostfix = "";

		var resolveUrl = function(url){
			var repoPath = new URL(url).pathname;
			var splitPath = repoPath.split("/", 5);

			var resolvedUrl = {};
			resolvedUrl.author = splitPath[1];
			resolvedUrl.repository = splitPath[2];
			resolvedUrl.branch = splitPath[4];
			resolvedUrl.directoryPath = repoPath.split(resolvedUrl.branch+"/", 2)[1];

			return resolvedUrl;
		}

		var downloadUrls = function(repo, resolvedUrl, paths, progress, options){

			var dirPaths = [];
			var files = [];
			var requestedPromises = [];

			progress.isProcessing.val=true;

			urlPrefix = "https://api.github.com/repos/"+resolvedUrl.author+"/"+resolvedUrl.repository+"/contents/";
			urlPostfix = "?ref="+resolvedUrl.branch;
			for(var i=0;i<paths.length;i++) {
				dirPaths.push(paths[i]);
			};

			// dirPaths.push(resolvedUrl.directoryPath);
			mapFileAndDirectory(dirPaths, files, requestedPromises, progress, resolvedUrl, options);
		}

		var mapFileAndDirectory = function(dirPaths, files, requestedPromises, progress, resolvedUrl, options){
			var uri = urlPrefix+dirPaths.pop()+urlPostfix;
			$http.get(uri).then(function (response){
				if(Array.isArray(response.data)) 				{
					for (var i=response.data.length-1; i>=0; i--){
						if(response.data[i].type=="dir"){
							dirPaths.push(response.data[i].path);
						}else{
							getFile(response.data[i].path, response.data[i].download_url, files, requestedPromises, progress);
						}
					}
				}
				else {
					getFile(response.data.path, response.data.download_url, files, requestedPromises, progress);
				}

				if(dirPaths.length<=0){
					$q.all(requestedPromises).then(function(data) {
						downloadFiles(files, requestedPromises, progress, resolvedUrl, options);
					});
				}else{
					mapFileAndDirectory(dirPaths, files, requestedPromises, progress, resolvedUrl, options);
				}
			});
		}

		var downloadFiles = function(files, requestedPromises, progress, resolvedUrl, options){
			var downloadFileName;

			if (resolvedUrl.directoryPath){
				var dirSplits = resolvedUrl.directoryPath.split("/");
				downloadFileName = decodeURI(dirSplits[dirSplits.length-1]);
			}
			else {
				downloadFileName = options.fileName || (resolvedUrl.author + "_" + resolvedUrl.repository);
			}

			var subfolder = "";
			if (options.subFolder)
				subfolder = options.subFolder + '/';

			var zip = new JSZip();
			for(var i=files.length-1; i>=0; i--){
				zip.file(subfolder+files[i].path, files[i].data);
			}

			progress.isProcessing.val=false;
			zip.generateAsync({type:"blob"}).then(function(content) {
				saveAs(content, downloadFileName + ".zip");
			});
		}

		var getFile = function (path, url, files, requestedPromises, progress) {
			var promise = $http.get(url, {responseType: "arraybuffer"}).then(function (file){
				files.push({path:path, data:file.data});
				progress.downloadedFiles.val = files.length;
			}, function(error){
				console.log(error);
			});
			requestedPromises.push(promise);
			progress.totalFiles.val = requestedPromises.length;
		}

    	return {
			downloadZippedFiles: function(repo, paths, progress, options){
				var resolvedUrl = resolveUrl(repo);

				if(!paths && (!resolvedUrl.directoryPath || resolvedUrl.directoryPath=="")){
					if(!resolvedUrl.branch || resolvedUrl.branch==""){
						resolvedUrl.branch="master";
					}

					var downloadUrl = "https://github.com/"+resolvedUrl.author+"/" + resolvedUrl.repository+"/archive/"+resolvedUrl.branch+".zip";

					window.location = downloadUrl;
				}else {
					downloadUrls(repo, resolvedUrl, paths, progress, options);
				}
			},
    	};
    }
]);

