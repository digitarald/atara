'use strict';

document.addEventListener('DOMContentLoaded', function() {
	var resultList = new List('results', {
		valueNames: ['name', 'runs', 'status'],
		page: 5000,
		indexAsync: true
	});

	var statusFilter = {};
	_.map(document.querySelectorAll('#filters button'), function(element) {
		element.addEventListener('click', function() {
			var action = this.classList.contains('active') ? 'remove' : 'add';
			this.classList[action]('active');
			filter();
		});
		statusFilter[element.dataset.filter] = {
			element: element,
			enabled: true
		}
	});

	function filter() {
		_.forEach(statusFilter, function(filter) {
			filter.enabled = filter.element.classList.contains('active');
		});

		resultList.filter(function(item) {
			var status = item.values().status;
			return statusFilter[status].enabled;
		})
	};

});